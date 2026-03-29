let tousLesRetards = [];
let toutesLesLignes = {};

const carte = L.map('carte').setView([50.633, 3.058], 12);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CartoDB'
}).addTo(carte);

const marqueurs = [];
const marqueursPonctuels = [];
const marqueurArrets = [];
let tracesLignes = L.layerGroup();

function iconeType(route_type) {
    if (route_type === 0) return '🚋';
    if (route_type === 1) return '🚇';
    return '🚌';
}

function couleurLigne(route_id) {
    const ligne = toutesLesLignes[route_id];
    if (ligne && ligne.route_color) return '#' + ligne.route_color;
    return '#185FA5';
}

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

function toggleTraces(btn) {
    if (carte.hasLayer(tracesLignes)) {
        carte.removeLayer(tracesLignes);
        btn.textContent = '🗺️ Tracés OFF';
    } else {
        carte.addLayer(tracesLignes);
        btn.textContent = '🗺️ Tracés ON';
    }
}
window.toggleTraces = toggleTraces;

async function chargerLignes() {
    const response = await fetch('/api/lignes');
    const data = await response.json();
    data.forEach(l => {
        toutesLesLignes[l.route_id] = l;
    });
}

async function chargerTraces() {
    const response = await fetch(
        'https://data.lillemetropole.fr/data/ogcapi/collections/ilevia:ilevia_traceslignes/items?limit=500&f=geojson'
    );
    const data = await response.json();
    tracesLignes.clearLayers();
    L.geoJSON(data, {
        style: feature => ({
            color: '#' + feature.properties.rgbhex_fond,
            weight: 2,
            opacity: 0.5
        }),
        onEachFeature: (feature, layer) => {
            const p = feature.properties;
            layer.bindPopup(`
                <strong>Ligne ${p.ligne}</strong><br>
                <span style="font-size:11px;color:#666">${p.name}</span>
            `);
        }
    }).addTo(tracesLignes);
}

async function chargerArrets() {
    const response = await fetch('/api/arrets');
    const data = await response.json();
    data.forEach(a => {
        const cercle = L.circleMarker([a.stop_lat, a.stop_lon], {
            radius: 3,
            fillColor: '#888',
            color: '#fff',
            weight: 1,
            fillOpacity: 0.6,
            zIndexOffset: -200
        }).addTo(carte);
        cercle.bindPopup(`<strong>${a.stop_name}</strong>`);
        marqueurArrets.push(cercle);
    });
}

async function chargerPassages() {
    const response = await fetch('/api/passages');
    const data = await response.json();

    marqueursPonctuels.forEach(m => carte.removeLayer(m));
    marqueursPonctuels.length = 0;

    data.forEach(p => {
        const couleur = p.route_color ? '#' + p.route_color : '#888';
        const icone = iconeType(p.route_type);

        const cercle = L.circleMarker([p.stop_lat, p.stop_lon], {
            radius: 4,
            fillColor: couleur,
            color: '#fff',
            weight: 1,
            fillOpacity: 0.6,
            zIndexOffset: -100
        }).addTo(carte);

        cercle.bindPopup(`
            <strong>${icone} Ligne ${p.route_id}</strong><br>
            ${p.stop_name}<br>
            <span style="color:#666;font-size:11px">
                Prochain passage : ${new Date(p.heure_theorique).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
            </span>
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
        const ligne = toutesLesLignes[r.route_id];
        const icone = ligne ? iconeType(ligne.route_type) : '🚌';
        const couleur = r.route_color ? '#' + r.route_color : couleurRetard(retard);

        const halo = L.divIcon({
            className: '',
            html: `
                <div class="halo-marker" style="
                    width:12px;height:12px;
                    border-radius:50%;
                    border:2px solid #E24B4A;
                    box-shadow: 0 0 4px 2px #E24B4A;
                "></div>
            `,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });

        const marqueur = L.marker([r.stop_lat, r.stop_lon], { icon: halo }).addTo(carte);

        marqueur.bindPopup(`
            <strong>${icone} Ligne ${r.route_id}</strong><br>
            <span style="font-size:11px;background:#${r.route_color || '185FA5'};color:#${r.route_text_color || 'FFFFFF'};padding:2px 6px;border-radius:4px">
                → ${r.trip_headsign || ''}
            </span><br><br>
            ${r.stop_name}<br>
            <span style="color:#E24B4A;font-weight:600">Retard : +${retard} min</span>
        `);

        marqueurs.push(marqueur);

        liste.innerHTML += `
            <div class="alerte">
                <span class="alerte-badge ${classeRetard(retard)}">
                    +${retard} min
                </span>
                <span class="badge-ligne" style="background:#${r.route_color || '185FA5'};color:#${r.route_text_color || 'FFFFFF'}">
                    ${icone} ${r.route_id}
                </span>
                <span style="flex:1">
                    <strong>${r.stop_name}</strong><br>
                    <span style="font-size:11px;color:#666">→ ${r.trip_headsign || ''}</span>
                </span>
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
        lignes.map(l => {
            const info = toutesLesLignes[l];
            const bg = info ? '#' + info.route_color : '#185FA5';
            const fg = info ? '#' + info.route_text_color : '#FFFFFF';
            const icone = info ? iconeType(info.route_type) : '🚌';
            return `<button class="filtre-ligne"
                style="background:${bg};color:${fg};border-color:${bg}"
                onclick="filtrerLigne('${l}', this)">
                ${icone} ${l}
            </button>`;
        }).join('');
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

chargerLignes().then(() => {
    chargerTraces();
    chargerArrets();
    chargerTout();
    setInterval(chargerTout, 60000);
});