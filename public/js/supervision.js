let tousLesRetards = [];
let toutesLesLignes = {};

const carte = L.map('carte').setView([50.633, 3.058], 12);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CartoDB'
}).addTo(carte);

const marqueurs = [];
const marqueursPonctuels = [];
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

async function chargerPassages() {
    const [passagesRes, retardsRes] = await Promise.all([
        fetch('/api/passages'),
        fetch('/api/retards')
    ]);
    const data = await passagesRes.json();
    const retards = await retardsRes.json();

    const indexRetards = {};
    retards.forEach(r => {
        r.lignes.forEach(l => {
            const key = r.stop_name + '|' + l.route_id;
            indexRetards[key] = l.retard_minutes;
        });
    });

    marqueursPonctuels.forEach(m => carte.removeLayer(m));
    marqueursPonctuels.length = 0;

    data.forEach(p => {
        const premiereLigne = p.lignes[0];
        const couleur = premiereLigne?.route_color ? '#' + premiereLigne.route_color : '#888';
        const aRetard = p.lignes.some(l => indexRetards[p.stop_name + '|' + l.route_id]);

        let marqueur;

        if (aRetard) {
            const icon = L.divIcon({
                className: '',
                html: `
                    <div style="position:relative;width:16px;height:16px">
                        <div class="halo-marker" style="
                            position:absolute;
                            width:16px;height:16px;
                            border-radius:50%;
                            border:2px solid #E24B4A;
                            box-shadow: 0 0 4px 2px #E24B4A;
                            top:0;left:0;
                        "></div>
                        <div style="
                            position:absolute;
                            width:8px;height:8px;
                            background:${couleur};
                            border:1px solid #fff;
                            border-radius:50%;
                            top:4px;left:4px;
                        "></div>
                    </div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            marqueur = L.marker([p.stop_lat, p.stop_lon], { icon }).addTo(carte);
        } else {
            marqueur = L.circleMarker([p.stop_lat, p.stop_lon], {
                radius: 4,
                fillColor: couleur,
                color: '#fff',
                weight: 1,
                fillOpacity: 0.6,
                zIndexOffset: -100
            }).addTo(carte);
        }

        const lignesHtml = p.lignes.map(l => {
            const retard = indexRetards[p.stop_name + '|' + l.route_id];
            return `
                <div style="margin:3px 0;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <span style="background:#${l.route_color || '185FA5'};color:#${l.route_text_color || 'FFFFFF'};padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600">
                        ${iconeType(l.route_type)} ${l.route_id}
                    </span>
                    <span style="font-size:11px">→ ${l.trip_headsign || ''}</span>
                    <span style="font-size:11px;color:#666;margin-left:auto">
                        ${new Date(l.heure_theorique).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                    </span>
                    ${retard ? `<span style="color:#E24B4A;font-weight:600;font-size:11px">+${retard} min</span>` : ''}
                </div>
            `;
        }).join('');

        marqueur.bindPopup(`
            <strong>${p.stop_name}</strong>
            ${aRetard ? '<span style="color:#E24B4A;font-size:11px;font-weight:600"> ⚠ Retard</span>' : ''}
            <br>${lignesHtml}
        `);

        marqueursPonctuels.push(marqueur);
    });
}

function afficherAlertes(retards) {
    const liste = document.getElementById('liste-alertes');
    liste.innerHTML = '';

    document.getElementById('compteur').textContent =
        retards.length > 0
        ? `${retards.length} arrêt${retards.length > 1 ? 's' : ''} en retard`
        : 'Réseau nominal';

    retards.forEach(r => {
        r.lignes.forEach(l => {
            liste.innerHTML += `
                <div class="alerte">
                    <span class="alerte-badge ${classeRetard(l.retard_minutes)}">
                        +${l.retard_minutes} min
                    </span>
                    <span class="badge-ligne" style="background:#${l.route_color || '185FA5'};color:#${l.route_text_color || 'FFFFFF'}">
                        ${iconeType(l.route_type)} ${l.route_id}
                    </span>
                    <span style="flex:1">
                        <strong>${r.stop_name}</strong><br>
                        <span style="font-size:11px;color:#666">→ ${l.trip_headsign || ''}</span>
                    </span>
                </div>
            `;
        });
    });

    if (!retards.length) {
        liste.innerHTML = '<p style="color:#999;font-size:13px">Aucune alerte en ce moment</p>';
    }
}

function renderFiltresLignes(retards) {
    const lignes = [...new Set(retards.flatMap(r => r.lignes.map(l => l.route_id)))].sort();
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
        const filtres = tousLesRetards.filter(r =>
            r.lignes.some(l => l.route_id === ligne)
        );
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
    chargerTout();
    setInterval(chargerTout, 60000);
});