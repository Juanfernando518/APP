const pb = new PocketBase('http://127.0.0.1:8090');

// --- CARGA INICIAL ---
async function cargarContenido() {
    try {
        const movies = await pb.collection('Movies').getFullList({ expand: 'genres,cast' });
        const movieContainer = document.getElementById('movies-container');
        renderizarCards(movies, movieContainer);

        const series = await pb.collection('Series').getFullList({ expand: 'genres' });
        const seriesContainer = document.getElementById('series-container');
        seriesContainer.innerHTML = '';
        series.forEach(item => {
            const imgUrl = item.video_file 
                ? `${pb.baseUrl}/api/files/${item.collectionId}/${item.id}/${item.video_file}`
                : 'https://via.placeholder.com/200x280';
            seriesContainer.innerHTML += `
                <div class="card">
                    <img src="${imgUrl}" alt="${item.name}">
                    <div class="card-info">
                        <h3>${item.name}</h3>
                        <p>Temporadas: ${item.number_seasons}</p>
                        <small>Estreno: ${item.relase_date ? item.relase_date.split(' ')[0] : 'N/A'}</small>
                    </div>
                </div>`;
        });
    } catch (err) { console.error("Error cargando contenido:", err); }
}

// --- FUNCIÓN UNIVERSAL PARA RENDERIZAR CARDS (CORREGIDA) ---
function renderizarCards(lista, contenedor) {
    contenedor.innerHTML = ''; 
    lista.forEach(item => {
        const imgUrl = item.video_file 
            ? `${pb.baseUrl}/api/files/${item.collectionId}/${item.id}/${item.video_file}`
            : 'https://via.placeholder.com/200x280';
        contenedor.innerHTML += `
            <div class="card" id="card-${item.id}">
                <img src="${imgUrl}" onclick="verDetalles('${item.id}', 'Movies')" style="cursor:pointer">
                <div class="card-info">
                    <h3>${item.name}</h3>
                    <span class="badge">⬇ ${item.downloads}</span>
                    <div class="acciones">
                        <button class="btn-edit" onclick="prepararEdicion('${item.id}', '${item.name}')">✏️</button>
                        <button class="btn-delete" onclick="eliminarRegistro('${item.id}', 'Movies')">🗑️</button>
                    </div>
                </div>
            </div>`;
    });
}

// --- GESTIÓN DE ACTORES (CREATE) ---
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
        alert("Actor guardado con éxito!");
        document.getElementById('actor-form').reset();
        window.toggleFormulario();
    } catch (err) { alert("Error al guardar actor"); }
});

// --- REPORTES Y FILTROS ---
window.reporteTopDescargas = async () => {
    const topMovies = await pb.collection('Movies').getFullList({ filter: 'downloads >= 8000', sort: '-downloads' });
    renderizarCards(topMovies, document.getElementById('movies-container'));
};

window.filtrarPorNombre = async () => {
    const busqueda = document.getElementById('search-input').value;
    const resultados = await pb.collection('Movies').getFullList({ filter: `name ~ "${busqueda}"` });
    renderizarCards(resultados, document.getElementById('movies-container'));
};

// --- ELIMINAR Y EDITAR ---
window.eliminarRegistro = async (id, coleccion) => {
    if (confirm("¿Eliminar registro?")) {
        await pb.collection(coleccion).delete(id);
        cargarContenido();
    }
};

window.prepararEdicion = async (id, nombreActual) => {
    const nuevoNombre = prompt("Nuevo nombre:", nombreActual);
    if (nuevoNombre && nuevoNombre !== nombreActual) {
        await pb.collection('Movies').update(id, { "name": nuevoNombre });
        cargarContenido();
    }
};

// --- GRÁFICOS ---
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
                label: 'Descargas',
                data: movies.map(m => m.downloads),
                backgroundColor: 'rgba(229, 9, 20, 0.6)'
            }]
        }
    });
};

// --- UTILIDADES ---
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
    const actores = record.expand?.cast?.map(a => `<li>${a.Name}</li>`).join('') || 'N/A';
    document.getElementById('detalle-info').innerHTML = `<h2>${record.name}</h2><ul>${actores}</ul>`;
    document.getElementById('modal-detalles').style.display = 'flex';
};
window.cerrarModal = () => document.getElementById('modal-detalles').style.display = 'none';

cargarContenido();