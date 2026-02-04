// Importamos el SDK (si usas CDN) o simplemente definimos la URL
const pbUrl = "http://127.0.0.1:8090"; 

// Esta función nos servirá para obtener las imágenes de los posters/videos
export const getFileUrl = (record, filename) => {
    return `${pbUrl}/api/files/${record.collectionId}/${record.id}/${filename}`;
};

export default pbUrl;