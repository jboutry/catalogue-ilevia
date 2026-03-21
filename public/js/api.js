// Récupère tous les datasets depuis l'API
async function fetchDatasets() {
    const response = await fetch('/api/datasets');
    const data = await response.json();
    return data;
}


async function fetchDatasetDetail(id) {
    const response = await fetch(`/api/datasets/${id}`);
    const data = await response.json();
    return data;
}