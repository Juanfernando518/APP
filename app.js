// --- CONEXIÓN CON POCKETBASE (NGROK) ---
const pb = new PocketBase("https://trifid-kerry-nonunitable.ngrok-free.dev");

pb.beforeSend = function (url, options) {
    options.headers = Object.assign({}, options.headers, {
        'ngrok-skip-browser-warning': 'true',
    });
    return { url, options };
};

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

// --- RENDERIZADO DE CARDS ---
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

// --- LÓGICA DE MODO ADMINISTRADOR ---
window.toggleModoAdmin = () => {
    const password = prompt("Introduce la clave de administrador:");
    
    if (password === "admin123") {
        document.body.classList.toggle('admin-active');
        
        // Mostrar/Ocultar botones especiales en el menú
        const adminButtons = document.querySelectorAll('.admin-only');
        const isAdmin = document.body.classList.contains('admin-active');
        
        adminButtons.forEach(btn => {
            btn.style.display = isAdmin ? 'inline-block' : 'none';
        });

        // Mostrar/Ocultar el panel de creación
        document.getElementById('admin-control-section').style.display = isAdmin ? 'block' : 'none';

        alert(isAdmin ? "Modo Administrador Activo" : "Modo Usuario Activo");
    } else {
        alert("Clave incorrecta.");
    }
};

// --- AGREGAR PELÍCULAS/SERIES (ADMIN) ---
document.getElementById('content-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const coleccion = document.getElementById('content-type').value;
    const nuevoContenido = {
        "name": document.getElementById('content-name').value,
        "downloads": parseInt(document.getElementById('content-downloads').value) || 0,
        "awards": document.getElementById('content-awards').value,
        "relase_date": new Date(document.getElementById('content-date').value).toISOString(),
        "video_file": document.getElementById('content-video').value 
    };

    try {
        await pb.collection(coleccion).create(nuevoContenido);
        alert("¡Contenido publicado con éxito!");
        document.getElementById('content-form').reset();
        cargarContenido(); // Recarga automática para que el usuario lo vea
    } catch (err) {
        alert("Error al guardar. Verifica que los campos sean correctos.");
    }
});

// --- REGISTRAR DESCARGA Y DETALLES ---
window.registrarDescargaYVer = async (id, coleccion) => {
    try {
        const record = await pb.collection(coleccion).getOne(id);
        const nuevoTotal = (parseInt(record.downloads) || 0) + 1;
        await pb.collection(coleccion).update(id, { "downloads": nuevoTotal });
        
        const contadorUI = document.getElementById(`count-${id}`);
        if (contadorUI) contadorUI.innerText = nuevoTotal;
        
        window.verDetalles(id, coleccion);
    } catch (err) {
        window.verDetalles(id, coleccion);
    }
};

window.verDetalles = async (id, coleccion) => {
    const record = await pb.collection(coleccion).getOne(id, { expand: 'cast,genres' });
    const actores = record.expand?.cast?.map(a => 
        `<li onclick="verColaboradores('${a.id}', '${a.Name}')" style="cursor:pointer; color:#e50914; text-decoration:underline;">${a.Name}</li>`
    ).join('') || 'N/A';
    
    document.getElementById('detalle-info').innerHTML = `
        <h2>${record.name}</h2>
        <p><strong>Premios:</strong> ${record.awards || 'N/A'}</p>
        <h3>Reparto:</h3>
        <ul>${actores}</ul>
    `;
    document.getElementById('modal-detalles').style.display = 'flex';
};

// --- FILTROS ---
window.filtrarPorNombre = async () => {
    const busqueda = document.getElementById('search-input').value;
    const resultados = await pb.collection(seccionActual).getFullList({ filter: `name ~ "${busqueda}"` });
    renderizarCards(resultados, document.getElementById(seccionActual.toLowerCase() + '-container'), seccionActual);
};

window.filtrarPorFechas = async () => {
    const inicio = document.getElementById('fecha-inicio').value;
    const fin = document.getElementById('fecha-fin').value;
    if(!inicio || !fin) return alert("Selecciona fechas");
    const filtro = `relase_date >= "${inicio} 00:00:00" && relase_date <= "${fin} 23:59:59"`;
    const resultados = await pb.collection(seccionActual).getFullList({ filter: filtro });
    renderizarCards(resultados, document.getElementById(seccionActual.toLowerCase() + '-container'), seccionActual);
};

// --- GESTIÓN DE INTERFAZ ---
window.mostrarSeccion = (tipo) => {
    seccionActual = tipo === 'movies' ? 'Movies' : 'Series';
    document.getElementById('movies-section').style.display = tipo === 'movies' ? 'block' : 'none';
    document.getElementById('series-section').style.display = tipo === 'series' ? 'block' : 'none';
};

window.eliminarRegistro = async (id, coleccion) => {
    if (confirm("¿Eliminar este registro permanentemente?")) {
        await pb.collection(coleccion).delete(id);
        cargarContenido();
    }
};

window.prepararEdicion = async (id, coleccion, nombreActual) => {
    const nuevoNombre = prompt("Editar nombre:", nombreActual);
    if (nuevoNombre && nuevoNombre !== nombreActual) {
        await pb.collection(coleccion).update(id, { "name": nuevoNombre });
        cargarContenido();
    }
};

// --- ACTORES Y EXTRAS ---
document.getElementById('actor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoActor = {
        "Name": document.getElementById('actor-name').value,
        "Country": document.getElementById('actor-country').value,
        "BirthDate": new Date(document.getElementById('actor-birth').value).toISOString(),
        "Gender": document.getElementById('actor-gender').value
    };
    await pb.collection('Actors').create(nuevoActor);
    alert("¡Actor registrado!");
    document.getElementById('actor-form').reset();
    window.toggleFormulario();
});

window.toggleFormulario = () => {
    const sec = document.getElementById('form-actor-section');
    sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
};

window.cerrarModal = () => document.getElementById('modal-detalles').style.display = 'none';

cargarContenido();