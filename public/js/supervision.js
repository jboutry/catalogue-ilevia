let tousLesRetards = [];

const carte = L.map('carte').setView([50.633, 3.058], 12);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CartoDB'
}).addTo(carte);

const marqueurs = [];
const marqueursPonctuels = [];

function couleurRetard(minutes) {
    if (minutes >= 10) return '#E24B4A';
    if (minutes >= 5)  return '#BA7517';
    return '#1D9E75';
}

function classeRetard(minutes) {
    if (minutes >= 10) return 'retard-fort';
    if (minutes >= 5)  return 'retard-moyen';
    return 'retard-faible';
}

async function chargerPassages() {
    const response = await fetch('/api/passages');
    const data = await response.json();

    marqueursPonctuels.forEach(m => carte.removeLayer(m));
    marqueursPonctuels.length = 0;

    data.forEach(p => {
        const cercle = L.circleMarker(
            [p.stop_lat, p.stop_lon], {
            radius: 5,
            fillColor: '#1D9E75',
            color: '#fff',
            weight: 1,
            fillOpacity: 0.5,
            zIndexOffset: -100
        }).addTo(carte);

        cercle.bindPopup(`
            <strong>${p.stop_name}</strong><br>
            Ligne ${p.route_id}<br>
            Passage : ${new Date(p.heure_theorique).toLocaleTimeString('fr-FR')}
        `);

        marqueursPonctuels.push(cercle);
    });
}

function afficherAlertes(retards) {
    marqueurs.forEach(m => carte.removeLayer(m));
    marqueurs.length = 0;

    const liste = document.getElementById('liste-alertes');
    liste.innerHTML = '';

    document.getElementById('compteur').textContent =
        retards.length > 0
        ? `${retards.length} arrêt${retards.length > 1 ? 's' : ''} en retard`
        : 'Réseau nominal';

    retards.forEach(r => {
        const retard = parseFloat(r.retard_minutes);

        const cercle = L.circleMarker(
            [r.stop_lat, r.stop_lon], {
            radius: 8,
            fillColor: couleurRetard(retard),
            color: '#fff',
            weight: 2,
            fillOpacity: 0.9
        }).addTo(carte);

        cercle.bindPopup(`
            <strong>${r.stop_name}</strong><br>
            Ligne ${r.route_id}<br>
            Retard : ${retard} min
        `);

        marqueurs.push(cercle);

        liste.innerHTML += `
            <div class="alerte">
                <span class="alerte-badge ${classeRetard(retard)}">
                    +${retard} min
                </span>
                <span><strong>Ligne ${r.route_id}</strong> — ${r.stop_name}</span>
            </div>
        `;
    });

    if (!retards.length) {
        liste.innerHTML = '<p style="color:#999;font-size:13px">Aucune alerte en ce moment</p>';
    }
}

function renderFiltresLignes(retards) {
    const lignes = [...new Set(retards.map(r => r.route_id))].sort();
    const filtres = document.getElementById('filtres-lignes');
    filtres.innerHTML =
        `<button class="filtre-ligne actif" onclick="filtrerLigne(null, this)">Toutes</button>` +
        lignes.map(l => `
            <button class="filtre-ligne" onclick="filtrerLigne('${l}', this)">
                ${l}
            </button>
        `).join('');
}

function filtrerLigne(ligne, el) {
    document.querySelectorAll('.filtre-ligne').forEach(b => b.classList.remove('actif'));
    el.classList.add('actif');
    if (!ligne) {
        afficherAlertes(tousLesRetards);
    } else {
        const filtres = tousLesRetards.filter(r => r.route_id === ligne);
        afficherAlertes(filtres);
    }
}

async function chargerRetards() {
    const response = await fetch('/api/retards');
    const data = await response.json();
    tousLesRetards = data;
    renderFiltresLignes(tousLesRetards);
    afficherAlertes(tousLesRetards);
}

async function chargerTout() {
    await chargerPassages();
    await chargerRetards();
}

window.filtrerLigne = filtrerLigne;

chargerTout();
setInterval(chargerTout, 60000);