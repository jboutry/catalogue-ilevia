const carte = L.map('carte').setView([50.633, 3.058], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(carte);

async function chargerRetards() {
    const response = await fetch('/api/retards');
    const data = await response.json();
    afficherAlertes(data);
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

const marqueurs = [];

function afficherAlertes(retards) {
    marqueurs.forEach(m => carte.removeLayer(m));
    marqueurs.length = 0;

    const liste = document.getElementById('liste-alertes');
    liste.innerHTML = '';

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

chargerRetards();
setInterval(chargerRetards, 60000);