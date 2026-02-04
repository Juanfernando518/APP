// NUEVA CONEXIÓN CON NGROK
const pb = new PocketBase("https://trifid-kerry-nonunitable.ngrok-free.dev");

// Saltamos la advertencia de ngrok para peticiones de datos (API)
pb.beforeSend = function (url, options) {
    options.headers = Object.assign({}, options.headers, {
        'ngrok-skip-browser-warning': 'true',
    });
    return { url, options };
};

// --- CARGA INICIAL ---
async function cargarContenido() {
    try {
        // Películas
        const movies = await pb.collection('Movies').getFullList({ expand: 'genres,cast' });
        const movieContainer = document.getElementById('movies-container');
        renderizarCards(movies, movieContainer, 'Movies');

        // Series
        const series = await pb.collection('Series').getFullList({ expand: 'genres' });
        const seriesContainer = document.getElementById('series-container');
        seriesContainer.innerHTML = '';
        series.forEach(item => {
            const imgUrl = item.video_file 
                ? `${pb.baseUrl}/api/files/${item.collectionId}/${item.id}/${item.video_file}?ngrok-skip-browser-warning=1`
                : 'https://via.placeholder.com/200x280';
            
            seriesContainer.innerHTML += `
                <div class="card">
                    <img src="${imgUrl}" alt="${item.name}" onclick="registrarDescargaYVer('${item.id}', 'Series')" style="cursor:pointer">
                    <div class="card-info">
                        <h3>${item.name}</h3>
                        <p>Temporadas: ${item.number_seasons}</p>
                        <span class="badge">⬇ <span id="count-${item.id}">${item.downloads || 0}</span></span>
                        <small>Estreno: ${item.relase_date ? item.relase_date.split(' ')[0] : 'N/A'}</small>
                    </div>
                </div>`;
        });
    } catch (err) { 
        console.error("Error cargando contenido:", err); 
    }
}

// --- FUNCIÓN DE RENDERIZADO DE CARDS ---
function renderizarCards(lista, contenedor, coleccion) {
    contenedor.innerHTML = ''; 
    lista.forEach(item => {
        const imgUrl = item.video_file 
            ? `${pb.baseUrl}/api/files/${item.collectionId}/${item.id}/${item.video_file}?ngrok-skip-browser-warning=1`
            : 'https://via.placeholder.com/200x280';
        
        contenedor.innerHTML += `
            <div class="card" id="card-${item.id}">
                <img src="${imgUrl}" onclick="registrarDescargaYVer('${item.id}', '${coleccion}')" style="cursor:pointer" onerror="this.src='https://via.placeholder.com/200x280'">
                <div class="card-info">
                    <h3>${item.name}</h3>
                    <span class="badge">⬇ <span id="count-${item.id}">${item.downloads || 0}</span></span>
                    <div class="acciones">
                        <button class="btn-edit" onclick="prepararEdicion('${item.id}', '${item.name}')">✏️</button>
                        <button class="btn-delete" onclick="eliminarRegistro('${item.id}', '${coleccion}')">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
}

// --- NUEVA FUNCIÓN: REGISTRAR DESCARGA (VISTA) Y VER DETALLES ---
window.registrarDescargaYVer = async (id, coleccion) => {
    try {
        // 1. Obtener el registro actual para saber cuántas descargas tiene
        const record = await pb.collection(coleccion).getOne(id);
        
        // 2. Incrementar el contador (+1)
        const nuevoTotal = (record.downloads || 0) + 1;
        
        // 3. Actualizar en PocketBase
        await pb.collection(coleccion).update(id, {
            "downloads": nuevoTotal
        });

        // 4. Actualizar el número en la interfaz inmediatamente
        const contadorUI = document.getElementById(`count-${id}`);
        if (contadorUI) {
            contadorUI.innerText = nuevoTotal;
            contadorUI.parentElement.style.backgroundColor = "#2ecc71"; // Efecto visual verde al subir
            setTimeout(() => { contadorUI.parentElement.style.backgroundColor = "#e50914"; }, 500);
        }

        // 5. Mostrar el modal de detalles
        window.verDetalles(id, coleccion);

    } catch (err) {
        console.error("Error al procesar la descarga:", err);
        window.verDetalles(id, coleccion); // Abrir modal aunque falle el contador
    }
};

// --- GESTIÓN DE ACTORES ---
document.getElementById('actor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoActor = {
        "Name": document.getElementById('actor-name').value,
        "Country": document.getElementById('actor-country').value,
        "BirthDate": new Date(document.getElementById('actor-birth').value).toISOString(),
        "Gender": document.getElementById('actor-gender').value
    };
    try {
        await pb.collection('Actors').create(nuevoActor);
        alert("¡Actor guardado con éxito!");
        document.getElementById('actor-form').reset();
        window.toggleFormulario();
    } catch (err) { 
        alert("Error al guardar actor: Verifica la conexión"); 
    }
});

// --- REPORTES Y FILTROS ---
window.reporteTopDescargas = async () => {
    const topMovies = await pb.collection('Movies').getFullList({ 
        filter: 'downloads >= 8000', 
        sort: '-downloads' 
    });
    renderizarCards(topMovies, document.getElementById('movies-container'), 'Movies');
};

window.filtrarPorNombre = async () => {
    const busqueda = document.getElementById('search-input').value;
    const resultados = await pb.collection('Movies').getFullList({ 
        filter: `name ~ "${busqueda}"` 
    });
    renderizarCards(resultados, document.getElementById('movies-container'), 'Movies');
};

// --- ELIMINAR Y EDITAR ---
window.eliminarRegistro = async (id, coleccion) => {
    if (confirm("¿Estás seguro de eliminar este registro?")) {
        try {
            await pb.collection(coleccion).delete(id);
            cargarContenido();
        } catch(err) { alert("No se pudo eliminar."); }
    }
};

window.prepararEdicion = async (id, nombreActual) => {
    const nuevoNombre = prompt("Nuevo nombre:", nombreActual);
    if (nuevoNombre && nuevoNombre !== nombreActual) {
        await pb.collection('Movies').update(id, { "name": nuevoNombre });
        cargarContenido();
    }
};

// --- GRÁFICOS (Chart.js) ---
let chartInstance = null;
window.generarGrafico = async () => {
    const movies = await pb.collection('Movies').getFullList({ sort: '-downloads' });
    const ctx = document.getElementById('myChart').getContext('2d');
    document.getElementById('reporte-section').style.display = 'block';
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: movies.map(m => m.name),
            datasets: [{
                label: 'Descargas por Película',
                data: movies.map(m => m.downloads),
                backgroundColor: 'rgba(229, 9, 20, 0.7)',
                borderColor: 'rgba(229, 9, 20, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
    document.getElementById('reporte-section').scrollIntoView({ behavior: 'smooth' });
};

// --- UTILIDADES DE INTERFAZ ---
window.mostrarSeccion = (tipo) => {
    document.getElementById('movies-section').style.display = tipo === 'movies' ? 'block' : 'none';
    document.getElementById('series-section').style.display = tipo === 'series' ? 'block' : 'none';
};

window.toggleFormulario = () => {
    const sec = document.getElementById('form-actor-section');
    sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
};

window.verDetalles = async (id, coleccion) => {
    const record = await pb.collection(coleccion).getOne(id, { expand: 'cast,genres' });
    const actores = record.expand?.cast?.map(a => `<li>${a.Name} (${a.Country})</li>`).join('') || 'N/A';
    const generos = record.expand?.genres?.map(g => g.name).join(', ') || 'N/A';
    
    document.getElementById('detalle-info').innerHTML = `
        <h2>${record.name}</h2>
        <p><strong>Género:</strong> ${generos}</p>
        <p><strong>Premios:</strong> ${record.awards || 'Ninguno'}</p>
        <h3>Reparto:</h3>
        <ul>${actores}</ul>
    `;
    document.getElementById('modal-detalles').style.display = 'flex';
};

window.cerrarModal = () => document.getElementById('modal-detalles').style.display = 'none';

// Arranque
cargarContenido();