// NUEVA CONEXIÓN CON NGROK
const pb = new PocketBase("https://trifid-kerry-nonunitable.ngrok-free.dev");

pb.beforeSend = function (url, options) {
    options.headers = Object.assign({}, options.headers, {
        'ngrok-skip-browser-warning': 'true',
    });
    return { url, options };
};

// Variable global para saber qué estamos viendo (ayuda a los filtros)
let seccionActual = 'Movies';

// --- CARGA INICIAL ---
async function cargarContenido() {
    try {
        const movies = await pb.collection('Movies').getFullList({ expand: 'genres,cast' });
        renderizarCards(movies, document.getElementById('movies-container'), 'Movies');

        const series = await pb.collection('Series').getFullList({ expand: 'genres,cast' });
        renderizarCards(series, document.getElementById('series-container'), 'Series');
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
                        <button class="btn-edit" onclick="prepararEdicion('${item.id}', '${coleccion}', '${item.name}')">✏️</button>
                        <button class="btn-delete" onclick="eliminarRegistro('${item.id}', '${coleccion}')">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
}

// --- REGISTRAR DESCARGA Y VER ---
window.registrarDescargaYVer = async (id, coleccion) => {
    try {
        const record = await pb.collection(coleccion).getOne(id);
        const nuevoTotal = (parseInt(record.downloads) || 0) + 1;
        
        await pb.collection(coleccion).update(id, { "downloads": nuevoTotal });

        const contadorUI = document.getElementById(`count-${id}`);
        if (contadorUI) {
            contadorUI.innerText = nuevoTotal; 
            const parentBadge = contadorUI.parentElement;
            parentBadge.style.backgroundColor = "#2ecc71"; 
            setTimeout(() => { parentBadge.style.backgroundColor = "#e50914"; }, 600);
        }
        window.verDetalles(id, coleccion);
    } catch (err) {
        window.verDetalles(id, coleccion);
    }
};

// --- FILTROS DINÁMICOS ---
window.filtrarPorNombre = async () => {
    const busqueda = document.getElementById('search-input').value;
    const resultados = await pb.collection(seccionActual).getFullList({ 
        filter: `name ~ "${busqueda}"` 
    });
    renderizarCards(resultados, document.getElementById(seccionActual.toLowerCase() + '-container'), seccionActual);
};

window.filtrarPorFechas = async () => {
    const inicio = document.getElementById('fecha-inicio').value;
    const fin = document.getElementById('fecha-fin').value;
    if(!inicio || !fin) return alert("Selecciona ambas fechas");

    const filtro = `relase_date >= "${inicio} 00:00:00" && relase_date <= "${fin} 23:59:59"`;
    const resultados = await pb.collection(seccionActual).getFullList({ filter: filtro });
    renderizarCards(resultados, document.getElementById(seccionActual.toLowerCase() + '-container'), seccionActual);
};

window.filtrarPorGenero = async () => {
    const genero = document.getElementById('genero-select').value;
    const filtro = genero ? `genres.name ~ "${genero}"` : "";
    const resultados = await pb.collection(seccionActual).getFullList({ 
        filter: filtro,
        expand: 'genres'
    });
    renderizarCards(resultados, document.getElementById(seccionActual.toLowerCase() + '-container'), seccionActual);
};

// --- DETALLES Y COLABORADORES ---
window.verDetalles = async (id, coleccion) => {
    const record = await pb.collection(coleccion).getOne(id, { expand: 'cast,genres' });
    
    // Convertimos actores en enlaces clicables para ver colaboradores
    const actores = record.expand?.cast?.map(a => 
        `<li onclick="verColaboradores('${a.id}', '${a.Name}')" style="cursor:pointer; color:#e50914; text-decoration:underline;">
            ${a.Name} (${a.Country})
        </li>`
    ).join('') || 'N/A';

    const generos = record.expand?.genres?.map(g => g.name).join(', ') || 'N/A';
    
    let infoExtra = coleccion === 'Series' ? `<p><strong>Temporadas:</strong> ${record.number_seasons || 1}</p>` : '';

    document.getElementById('detalle-info').innerHTML = `
        <h2>${record.name}</h2>
        <p><strong>Género:</strong> ${generos}</p>
        <p><strong>Premios:</strong> ${record.awards || 'Ninguno'}</p>
        ${infoExtra}
        <h3>Reparto (Clic para ver colaboradores):</h3>
        <ul>${actores}</ul>
    `;
    document.getElementById('modal-detalles').style.display = 'flex';
};

window.verColaboradores = async (actorId, nombreActor) => {
    const pelis = await pb.collection('Movies').getFullList({
        filter: `cast ~ "${actorId}"`,
        expand: 'cast'
    });

    let colaboradores = new Set();
    pelis.forEach(p => {
        p.expand?.cast?.forEach(actor => {
            if(actor.id !== actorId) colaboradores.add(actor.Name);
        });
    });

    const lista = Array.from(colaboradores).join(', ');
    alert(`El actor ${nombreActor} ha trabajado con: ${lista || 'ningún otro actor en nuestra base.'}`);
};

// --- GESTIÓN ---
window.mostrarSeccion = (tipo) => {
    seccionActual = tipo === 'movies' ? 'Movies' : 'Series';
    document.getElementById('movies-section').style.display = tipo === 'movies' ? 'block' : 'none';
    document.getElementById('series-section').style.display = tipo === 'series' ? 'block' : 'none';
};

window.eliminarRegistro = async (id, coleccion) => {
    if (confirm("¿Estás seguro?")) {
        await pb.collection(coleccion).delete(id);
        cargarContenido();
    }
};

window.prepararEdicion = async (id, coleccion, nombreActual) => {
    const nuevoNombre = prompt("Nuevo nombre:", nombreActual);
    if (nuevoNombre && nuevoNombre !== nombreActual) {
        await pb.collection(coleccion).update(id, { "name": nuevoNombre });
        cargarContenido();
    }
};

// --- ACTORES Y GRÁFICOS ---
document.getElementById('actor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoActor = {
        "Name": document.getElementById('actor-name').value,
        "Country": document.getElementById('actor-country').value,
        "BirthDate": new Date(document.getElementById('actor-birth').value).toISOString(),
        "Gender": document.getElementById('actor-gender').value
    };
    await pb.collection('Actors').create(nuevoActor);
    alert("¡Actor guardado!");
    document.getElementById('actor-form').reset();
    window.toggleFormulario();
});

window.generarGrafico = async () => {
    const movies = await pb.collection('Movies').getFullList({ sort: '-downloads' });
    const ctx = document.getElementById('myChart').getContext('2d');
    document.getElementById('reporte-section').style.display = 'block';
    if (window.chartInstance) window.chartInstance.destroy();
    window.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: movies.map(m => m.name),
            datasets: [{
                label: 'Descargas',
                data: movies.map(m => m.downloads),
                backgroundColor: 'rgba(229, 9, 20, 0.7)'
            }]
        }
    });
};

window.toggleFormulario = () => {
    const sec = document.getElementById('form-actor-section');
    sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
};

window.cerrarModal = () => document.getElementById('modal-detalles').style.display = 'none';

cargarContenido();