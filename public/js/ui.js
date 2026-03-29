function renderCartes(datasets) {
    const grid = document.getElementById('grid');
    grid.innerHTML = datasets.map(d => `
        <div class="card" onclick="ouvrirDetail(${d.id})">
            <div class="card-top">
                <div class="card-titre">${d.nom_metier}</div>
                <span class="${classeBadge(d.domaine)}">${d.domaine}</span>
            </div>
            <div class="card-desc">${d.description}</div>
            <div class="card-meta">
                Owner : ${d.owner_metier} — MàJ : ${d.frequence_maj}
            </div>
            <div class="qualite">
                <div class="qbar-bg">
                    <div class="qbar" style="width:${d.qualite_score}%; background:${couleurQualite(d.qualite_score)}"></div>
                </div>
                <span class="qscore" style="color:${couleurQualite(d.qualite_score)}">${d.qualite_score}%</span>
            </div>
        </div>
    `).join('');
}

function couleurQualite(score) {
    const s = parseFloat(score);
    if (s >= 90) return '#1D9E75';
    else if (s >= 75) return '#BA7517';
    else return '#E24B4A';
}

function classeBadge(domaine) {
    if (domaine === 'Réseau')        return 'badge-reseau';
    else if (domaine === 'Voyageurs')    return 'badge-voyageurs';
    else if (domaine === 'Maintenance')  return 'badge-maintenance';
    else if (domaine === 'Reporting')    return 'badge-reporting';
    else if (domaine === 'Exploitation') return 'badge-exploitation';
}

async function ouvrirDetail(id) {
    const dataset = await fetchDatasetDetail(id);
    afficherPanel(dataset);
}
window.ouvrirDetail = ouvrirDetail;

function afficherPanel(d) {
    const panel = document.getElementById('panel');
    const overlay = document.getElementById('overlay');

    panel.innerHTML = `
        <div class="panel-header">
            <div class="panel-titre">${d.nom_metier}</div>
            <div style="display:flex;gap:8px">
                <button id="btn-modifier">✏️ Modifier</button>
                <button id="btn-fermer">✕</button>
            </div>
        </div>
        <p>${d.description}</p>
        <div class="section-label">Qualité</div>
        <div class="qualite" style="margin: 6px 0 12px">
            <div class="qbar-bg">
                <div class="qbar" style="width:${d.qualite_score}%; background:${couleurQualite(d.qualite_score)}"></div>
            </div>
            <span class="qscore" style="color:${couleurQualite(d.qualite_score)}">${parseFloat(d.qualite_score).toFixed(0)}%</span>
        </div>
        <div style="font-size:12px; color:#666; margin-bottom:8px">${d.qualite_detail || ''}</div>
        <div class="section-label">Informations</div>
        <div><strong>Owner :</strong> ${d.owner_metier}</div>
        <div><strong>Source :</strong> ${d.source_systeme}</div>
        <div><strong>Mise à jour :</strong> ${d.frequence_maj}</div>
        <div><strong>Sensibilité :</strong> ${d.sensibilite}</div>
        ${d.alerte ? `
            <div class="section-label">Alerte</div>
            <div class="alerte-panel">${d.alerte}</div>
        ` : ''}
        <div class="section-label">Tags</div>
        <div class="tags">${(d.tags || []).map(t =>
            `<span class="tag">${t}</span>`
        ).join('')}</div>
        <div class="section-label">Lineage</div>
        <div class="lineage">
            ${(d.lineage || []).map((l, i) => `
                ${i > 0 ? '<div class="lineage-fleche">&#8595;</div>' : ''}
                <div class="lineage-etape lineage-${l.type_etape}">
                    <span class="lineage-type">${l.type_etape}</span>
                    <span class="lineage-libelle">${l.libelle}</span>
                </div>
            `).join('')}
        </div>
    `;

    overlay.classList.add('open');

    document.getElementById('btn-fermer').addEventListener('click', () => {
        overlay.classList.remove('open');
    });

    document.getElementById('btn-modifier').addEventListener('click', () => {
        afficherFormulaire(d);
    });
}

function afficherFormulaire(d) {
    const panel = document.getElementById('panel');
    panel.innerHTML = `
        <div class="panel-header">
            <div class="panel-titre">Modifier — ${d.nom_metier}</div>
            <button id="btn-annuler">✕</button>
        </div>
        <div class="form-groupe">
            <label>Owner métier</label>
            <input id="f-owner" type="text" value="${d.owner_metier || ''}"/>
        </div>
        <div class="form-groupe">
            <label>Fréquence de mise à jour</label>
            <input id="f-frequence" type="text" value="${d.frequence_maj || ''}"/>
        </div>
        <div class="form-groupe">
            <label>Score de qualité (%)</label>
            <input id="f-score" type="number" min="0" max="100"
                   value="${parseFloat(d.qualite_score) || 0}"/>
        </div>
        <div class="form-groupe">
            <label>Détail qualité</label>
            <textarea id="f-detail">${d.qualite_detail || ''}</textarea>
        </div>
        <div class="form-groupe">
            <label>Alerte</label>
            <textarea id="f-alerte">${d.alerte || ''}</textarea>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button id="btn-sauvegarder" class="btn-primary">Sauvegarder</button>
            <button id="btn-annuler2">Annuler</button>
        </div>
    `;

    document.getElementById('btn-annuler').addEventListener('click', () => {
        afficherPanel(d);
    });

    document.getElementById('btn-annuler2').addEventListener('click', () => {
        afficherPanel(d);
    });

    document.getElementById('btn-sauvegarder').addEventListener('click', async () => {
        const body = {
            owner_metier:   document.getElementById('f-owner').value,
            frequence_maj:  document.getElementById('f-frequence').value,
            qualite_score:  document.getElementById('f-score').value,
            qualite_detail: document.getElementById('f-detail').value,
            alerte:         document.getElementById('f-alerte').value,
        };

        const response = await fetch(`/api/datasets/${d.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await response.json();

if (result.success) {
    const updated = await fetchDatasetDetail(d.id);
    await rechargerDatasets();
    afficherPanel(updated);
} else {
    alert('Erreur : ' + result.error);
}
    });
}

function renderFiltres(datasets) {
    const domaines = [...new Set(datasets.map(d => d.domaine))];
    const filtres = document.getElementById('filtres');
    filtres.innerHTML =
        `<button class="filtre-btn actif" onclick="filtrer(null)">Tous</button>` +
        domaines.map(d => `
            <button class="filtre-btn ${classeBadge(d)}"
                    onclick="filtrer('${d}')">
                ${d}
            </button>
        `).join('');
}

function renderDashboard(q) {
    const dashboard = document.getElementById('dashboard');
    dashboard.innerHTML = `
        <div class="dashboard">
            <div class="dash-card">
                <div class="dash-valeur">${q.total}</div>
                <div class="dash-label">Datasets</div>
            </div>
            <div class="dash-card">
                <div class="dash-valeur" style="color:${q.score_moyen >= 90 ? '#1D9E75' : q.score_moyen >= 75 ? '#BA7517' : '#E24B4A'}">${q.score_moyen}%</div>
                <div class="dash-label">Qualité moyenne</div>
            </div>
            <div class="dash-card">
                <div class="dash-valeur" style="color:#1D9E75">${q.bonne}</div>
                <div class="dash-label">Bonne qualité</div>
            </div>
            <div class="dash-card">
                <div class="dash-valeur" style="color:#BA7517">${q.moyenne}</div>
                <div class="dash-label">Qualité moyenne</div>
            </div>
            <div class="dash-card">
                <div class="dash-valeur" style="color:#E24B4A">${q.faible}</div>
                <div class="dash-label">Faible qualité</div>
            </div>
        </div>
    `;
}