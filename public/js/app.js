let tousLesDatasets = [];
let filtreActif = null;

document.addEventListener('DOMContentLoaded', async () => {
    const [datasets, qualite] = await Promise.all([
        fetchDatasets(),
        fetchQualite()
    ]);
    tousLesDatasets = datasets;
    renderDashboard(qualite);
    renderCartes(tousLesDatasets);
    renderFiltres(tousLesDatasets);
});

function filtrer(domaine) {
    filtreActif = domaine;
    if (!domaine) {
        renderCartes(tousLesDatasets);
    } else {
        const filtres = tousLesDatasets.filter(d => d.domaine === domaine);
        renderCartes(filtres);
    }
}

function rechercher(texte) {
    const q = texte.toLowerCase();
    const filtres = tousLesDatasets.filter(d => {
        return d.nom_metier.toLowerCase().includes(q) ||
               d.description.toLowerCase().includes(q);
    });
    renderCartes(filtres);
}

window.rechercher = rechercher;
window.filtrer = filtrer;

function fermerPanel() {
    document.getElementById('overlay').classList.remove('open');
}
window.fermerPanel = fermerPanel;