// CAMBIO CRÍTICO: Usamos la URL de ngrok para que las imágenes sean públicas
const pbUrl = "https://trifid-kerry-nonunitable.ngrok-free.dev"; 

// Esta función ahora añade el parámetro para saltar el aviso de ngrok en las imágenes
export const getFileUrl = (record, filename) => {
    if (!filename) return 'https://via.placeholder.com/200x280';
    return `${pbUrl}/api/files/${record.collectionId}/${record.id}/${filename}?ngrok-skip-browser-warning=1`;
};

export default pbUrl;