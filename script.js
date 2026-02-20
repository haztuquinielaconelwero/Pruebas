/* = Conexión con Python (API) = */
const API_BASE = window.location.hostname === 'localhost'
? 'http://localhost:8000'
: 'https://pruebas-production-ac52.up.railway.app';
/* = Esto de abajo trabaja en identificar el vendedor = */
function getQueryParam(name) {
const params = new URLSearchParams(window.location.search);
return params.get(name);
}
const currentVendedor = (getQueryParam("vendedor") || "").trim();
if (currentVendedor) {
localStorage.setItem('vendedor', currentVendedor);
console.log('✅ Vendedor guardado:', currentVendedor);
} else {
console.warn('⚠️ No hay vendedor en la URL');
}
const heroVendorEl = document.getElementById('heroVendorText');
if (heroVendorEl) {
heroVendorEl.textContent = currentVendedor || localStorage.getItem('vendedor') || 'Vendedor';
}
/* = Funciones globales = */
let quinielaPredictions = {};
let savedQuinielas = [];
let sentQuinielas = [];
let partidos = [];
/* =Esto de abajo trabaja en el guardado = */
const userId = (() => {
let id = localStorage.getItem('userId')
if (!id) {
id = 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
localStorage.setItem('userId', id)
}
return id
})()
function loadFromStorage() {
const raw = localStorage.getItem('quinielasData');
if (!raw) return;
try {
const data = JSON.parse(raw);
savedQuinielas = data.savedQuinielas || [];
sentQuinielas = data.sentQuinielas || [];
console.log('🔁 Cargado desde localStorage:', savedQuinielas.length, 'guardadas,', sentQuinielas.length, 'enviadas');
} catch (e) {
console.error('⚠️ Error leyendo localStorage, limpiando...', e);
localStorage.removeItem('quinielasData');
savedQuinielas = [];
sentQuinielas = [];
}
}
function saveToStorage() {
try {
const data = {
savedQuinielas,
sentQuinielas
};
localStorage.setItem('quinielasData', JSON.stringify(data));
console.log('💾 Guardado en localStorage');
} catch (e) {
console.error('❌ Error guardando en localStorage:', e);
}
}
loadFromStorage();
async function deleteQuiniela(index) {
const quiniela = savedQuinielas[index];
if (!quiniela) {
console.error('❌ Quiniela no encontrada en index:', index);
return;
}
savedQuinielas.splice(index, 1);
saveToStorage();
updateSavedBadge && updateSavedBadge();
showSaved && showSaved();
}
function showToast(message, type) {
const toast = document.createElement('div');
toast.style.cssText = `
position: fixed;
bottom: 100px;
left: 50%;
transform: translateX(-50%);
-webkit-transform: translateX(-50%);
background: ${type === 'success' ? '#10b981' : '#ef4444'};
color: white;
padding: 12px 24px;
border-radius: 8px;
font-size: 0.875rem;
font-weight: 600;
z-index: 10000;
box-shadow: 0 4px 12px rgba(0,0,0,0.3);
-webkit-box-shadow: 0 4px 12px rgba(0,0,0,0.3);
`;
toast.textContent = message;
document.body.appendChild(toast);
setTimeout(() => {
toast.style.opacity = '0';
toast.style.transition = 'opacity 300ms ease';
toast.style.webkitTransition = 'opacity 300ms ease';
setTimeout(() => toast.remove(), 300);
}, 2500);
}
/* = Partidos de la jornada = */
async function cargarPartidos() {
try {
console.log('🔄 Cargando partidos...');
const response = await fetch(`${API_BASE}/api/partidos`);
const data = await response.json();

if (data.success && data.partidos) {
partidos = data.partidos;
console.log('✅ Partidos cargados:', partidos.length);
return true;
}
console.error('❌ Error: respuesta sin partidos');
return false;
} catch (error) {
console.error('❌ Error cargando partidos:', error);
return false;
}
}
/* = Funciones de la pagina quiniela = */
function renderQuinielaMatches() {
const container = document.getElementById('quinielaMatches');
if (!container) {
console.error('❌ No se encontró #quinielaMatches');
return;
}
if (!partidos || partidos.length === 0) {
container.innerHTML = '<p style="text-align:center;padding:20px;color:#999;">Cargando partidos...</p>';
return;
}
container.innerHTML = partidos.map(partido => `
<div class="quiniela-match" data-match-id="${partido.id}">
<div class="quiniela-match-row">
<button class="quiniela-btn ${quinielaPredictions[partido.id]?.includes('L') ? 'selected' : ''}"
onclick="selectPrediction(${partido.id}, 'L', this)">L</button>
<div class="quiniela-team-inline">
<img src="${partido.localLogo}" alt="${partido.local}" class="team-logo-small">
<span>${partido.local}</span>
</div>
<button class="quiniela-btn ${quinielaPredictions[partido.id]?.includes('E') ? 'selected' : ''}"
onclick="selectPrediction(${partido.id}, 'E', this)">E</button>
<div class="quiniela-team-inline">
<span>${partido.visitante}</span>
<img src="${partido.visitanteLogo}" alt="${partido.visitante}" class="team-logo-small">
</div>
<button class="quiniela-btn ${quinielaPredictions[partido.id]?.includes('V') ? 'selected' : ''}"
onclick="selectPrediction(${partido.id}, 'V', this)">V</button>
</div>
</div>
`).join('');
}
function calculateRealQuinielas() {
if (!quinielaPredictions || Object.keys(quinielaPredictions).length === 0) return 0;
let total = 1;
partidos.forEach(partido => {
const preds = quinielaPredictions[partido.id];
if (!preds || preds.length === 0) return;
total *= preds.length;
});
return total;
}
function updateQuinielaCount() {
const count = calculateRealQuinielas();
const countDisplay = document.querySelector('.quiniela-count');
if (countDisplay) {
countDisplay.textContent = count;
}
}
function calculateCurrentPrice() {
const currentQuinielas = calculateRealQuinielas();
if (currentQuinielas === 0) return 0;
const pricePerQuiniela = currentQuinielas >= 10 ? 25 : 30;
return currentQuinielas * pricePerQuiniela;
}
function updatePrice() {
const total = calculateCurrentPrice();
const priceDisplay = document.querySelector('.price-display');
if (priceDisplay) {
priceDisplay.textContent = `$${total}`;
}
}
function updateSavedBadge() {
const savedButton = document.querySelector('.action-btn[onclick="showSaved()"]');
if (!savedButton) return;
const oldBadge = savedButton.querySelector('.saved-badge');
if (oldBadge) oldBadge.remove();
if (savedQuinielas && savedQuinielas.length > 0) {
const badge = document.createElement('span');
badge.className = 'saved-badge';
badge.textContent = savedQuinielas.length;
badge.style.cssText = 'position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;';
savedButton.style.position = 'relative';
savedButton.appendChild(badge);
}
}
function showErrorModal(message) {
openModal(`
<div style="text-align: center; display: flex; flex-direction: column; align-items: center;">
<img src="logos/tarjetaroja.png" alt="Tarjeta Roja" style="width: 120px; height: auto; margin: 0 auto 1rem auto; display: block;">
<h3 style="color: #ef4444; margin-bottom: 1rem;">¡Tarjeta Roja!</h3>
<p style="font-size: 1rem; color: var(--gris-300);">${message}</p>
</div>
`);
}
function clearQuiniela() {
quinielaPredictions = {};
const nameInput = document.getElementById('playerName');
if (nameInput) nameInput.value = '';
renderQuinielaMatches();
saveToStorage && saveToStorage();
updateQuinielaCount();
updatePrice();
}
function randomQuiniela() {
const options = ['L', 'E', 'V'];
quinielaPredictions = {};
let doublesCount = 0;
let triplesCount = 0;
partidos.forEach(partido => {
const shouldBeDouble = Math.random() < 0.20 && doublesCount < 4;
const shouldBeTriple = Math.random() < 0.05 && triplesCount < 3;
if (shouldBeTriple) {
quinielaPredictions[partido.id] = ['L', 'E', 'V'];
triplesCount++;
} else if (shouldBeDouble) {
const opts = [...options];
opts.splice(Math.floor(Math.random() * 3), 1);
quinielaPredictions[partido.id] = opts;
doublesCount++;
} else {
quinielaPredictions[partido.id] = [options[Math.floor(Math.random() * 3)]];
}
});
renderQuinielaMatches();
saveToStorage && saveToStorage();
updateQuinielaCount();
updatePrice();
}
/* = Límites de dobles y triples + selección = */
function validateDoublesAndTriples(predictionsObj = quinielaPredictions) {
let doublesCount = 0;
let triplesCount = 0;
Object.values(predictionsObj || {}).forEach(predictions => {
if (Array.isArray(predictions)) {
if (predictions.length === 2) doublesCount++;
if (predictions.length === 3) triplesCount++;
}
});
if (doublesCount > 4) {
showErrorModal('Máximo 4 dobles permitidos');
return false;
}
if (triplesCount > 3) {
showErrorModal('Máximo 3 triples permitidos');
return false;
}
return true;
}
function selectPrediction(matchId, prediction, button) {
if (!quinielaPredictions[matchId]) {
quinielaPredictions[matchId] = [];
}
const currentPreds = quinielaPredictions[matchId];
const index = currentPreds.indexOf(prediction);
const simulated = JSON.parse(JSON.stringify(quinielaPredictions));
if (!simulated[matchId]) simulated[matchId] = [];
if (index === -1) {
simulated[matchId].push(prediction);
} else {
simulated[matchId].splice(index, 1);
if (simulated[matchId].length === 0) {
delete simulated[matchId];
}
}
if (!validateDoublesAndTriples(simulated)) {
return;
}
if (index === -1) {
currentPreds.push(prediction);
button.classList.add('selected');
} else {
currentPreds.splice(index, 1);
button.classList.remove('selected');
if (currentPreds.length === 0) {
delete quinielaPredictions[matchId];
}
}
saveToStorage && saveToStorage();
updateQuinielaCount();
updatePrice();
}
/* = Combinaciones y guardado = */
function generateQuinielaCombinations() {
const selectionsPerMatch = partidos.map(partido => {
const preds = quinielaPredictions[partido.id];
if (!preds || preds.length === 0) {
return ['-'];
}
return preds;
});
let combinations = [[]];
selectionsPerMatch.forEach(matchOptions => {
const newCombinations = [];
combinations.forEach(baseCombo => {
matchOptions.forEach(option => {
newCombinations.push([...baseCombo, option]);
});
});
combinations = newCombinations;
});
return combinations;
}
async function saveQuiniela() {
const nameInput = document.getElementById("playerName");
const name = nameInput ? nameInput.value.trim() : "";
if (!name) {
showErrorModal("Por favor escribe tu nombre");
return;
}
if (name.length > 30) {
showErrorModal("El nombre no puede tener más de 30 caracteres");
return;
}
if (!partidos || partidos.length === 0) {
showErrorModal("No hay partidos configurados");
return;
}
const completedMatches = Object.keys(quinielaPredictions || {}).filter(function (id) {
return quinielaPredictions[id] && quinielaPredictions[id].length > 0;
}).length;
if (completedMatches < partidos.length) {
showErrorModal("Completa todas las predicciones");
return;
}
if (!validateDoublesAndTriples()) {
return;
}
const vendedor = currentVendedor;
if (!vendedor) {
showErrorModal("Link inválido: falta el vendedor en la URL");
return;
}
const combos = generateQuinielaCombinations();
if (!Array.isArray(savedQuinielas)) savedQuinielas = [];
let exitosas = 0;
for (const combo of combos) {
const predictionsObj = {};
partidos.forEach((partido, index) => {
predictionsObj[partido.id] = [combo[index]];
});
savedQuinielas.push({
id: Date.now() + "-" + Math.random(),
name: name,
vendedor: vendedor,
predictions: predictionsObj,
folio: null,
estado: "borrador"
});
exitosas++;
}
quinielaPredictions = {};
if (nameInput) nameInput.value = "";
renderQuinielaMatches && renderQuinielaMatches();
updateQuinielaCount && updateQuinielaCount();
updatePrice && updatePrice();
updateSavedBadge && updateSavedBadge();
saveToStorage && saveToStorage();
if (exitosas === 0) {
showErrorModal("No se pudo guardar ninguna quiniela");
}
}
/* = Navegación principal = */
const navToggle = document.getElementById("navToggle");
const floatingNav = document.getElementById("floatingNav");
const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
if (navToggle && floatingNav) {
navToggle.addEventListener("click", function(e) {
e.preventDefault();
e.stopPropagation();
floatingNav.classList.toggle("open");
});
document.addEventListener("click", function(e) {
if (floatingNav && floatingNav.classList.contains("open")) {
if (!floatingNav.contains(e.target)) {
floatingNav.classList.remove("open");
}
}
});
}
navItems.forEach(function(item) {
item.addEventListener("click", function(e) {
e.preventDefault();
navItems.forEach(function(nav) { nav.classList.remove("active"); });
this.classList.add("active");
const page = this.getAttribute("data-page");
floatingNav.classList.remove("open");
navigateTo(page);
});
});
function updateHero(page) {
document.querySelectorAll(".hero-admin").forEach(function(hero) {
hero.classList.remove("active");
});
const pageId = "hero-" + page;
if (pageId === "hero-inicio") {
document.getElementById("hero")?.classList.add("active");
} else if (pageId === "hero-resultados") {
document.getElementById("hero-resultados")?.classList.add("active");
} else if (pageId === "hero-quiniela") {
document.getElementById("hero-quiniela")?.classList.add("active");
} else if (pageId === "hero-analisis") {
document.getElementById("hero-analisis")?.classList.add("active");
} else if (pageId === "hero-ayuda") {
document.getElementById("hero-ayuda")?.classList.add("active");
}
}
/* = Actualizar los hero con las quinielas Jugando o No jugando =*/
const STATS_CACHE_DURATION = 5000;
let statsCache = { 
jugando: 0, 
no_jugando: 0, 
lastUpdate: 0 
};
async function fetchAPI(endpoint, timeout = 3000) {
try {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);
const res = await fetch(API_BASE + endpoint, {
signal: controller.signal,
headers: { 'Accept': 'application/json' }
});
clearTimeout(timeoutId);
if (!res.ok) {
console.error("❌ Error HTTP:", res.status);
return null;
}
return await res.json();
} catch (err) {
if (err.name === 'AbortError') {
console.error("⏱️ Timeout en", endpoint);
} else {
console.error("🔌 Error de red en", endpoint, err.message);
}
return null;
}
}
async function updateHeroStats() {
const now = Date.now();
if (now - statsCache.lastUpdate < STATS_CACHE_DURATION) {
console.log('📦 Stats en cache, saltando fetch');
return;
}
const data = await fetchAPI(`/api/stats?jornada=${encodeURIComponent(jornadaActual.nombre)}&userId=${userId}`);
if (!data || !data.success) {
console.warn('⚠️ Backend no disponible, usando fallback local');
updateHeroStatsLocal();
return;
}
statsCache = {
jugando: data.stats.jugando,
no_jugando: data.stats.no_jugando,
lastUpdate: now
};
actualizarContadorAnimado('quinielasJugandoCount', data.stats.jugando);
actualizarContadorAnimado('quinielasNoJugandoCount', data.stats.no_jugando);
actualizarContadorAnimado('quinielasJugandoCountResultados', data.stats.jugando);
actualizarContadorAnimado('quinielasNoJugandoCountResultados', data.stats.no_jugando);
console.log('⚡ Stats actualizados - Jugando:', data.stats.jugando, '| No jugando:', data.stats.no_jugando);
}
function actualizarContadorAnimado(elementId, targetValue) {
const elemento = document.getElementById(elementId);
if (!elemento) return;
const currentValue = parseInt(elemento.textContent) || 0;
if (currentValue === targetValue) return;
if (Math.abs(targetValue - currentValue) <= 3) {
elemento.style.transform = 'scale(1.15)';
elemento.style.transition = 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)';
setTimeout(() => {
elemento.textContent = targetValue;
elemento.style.transform = 'scale(1)';
}, 75);
return;
}
const diferencia = targetValue - currentValue;
const pasos = 30;
const incremento = diferencia / pasos;
const duracion = 800; 
const intervalo = duracion / pasos;
let contador = 0;
const timer = setInterval(() => {
contador++;
const nuevoValor = Math.round(currentValue + (incremento * contador));
elemento.textContent = nuevoValor;
if (contador >= pasos) {
elemento.textContent = targetValue;
clearInterval(timer);
}
}, intervalo);
}
function updateHeroStatsLocal() {
if (!sentQuinielas || sentQuinielas.length === 0) {
console.log('📭 No hay quinielas locales');
return;
}
const jornadaNombre = jornadaActual?.nombre || 'Jornada 9';
const jugandoCount = sentQuinielas.filter(q => 
q.jornada === jornadaNombre && q.estado === 'jugando'
).length;
const noJugandoCount = sentQuinielas.filter(q => 
q.jornada === jornadaNombre && 
['pendiente', 'espera'].includes(q.estado)
).length;
actualizarContadorAnimado('quinielasJugandoCount', jugandoCount);
actualizarContadorAnimado('quinielasNoJugandoCount', noJugandoCount);
actualizarContadorAnimado('quinielasJugandoCountResultados', jugandoCount);
actualizarContadorAnimado('quinielasNoJugandoCountResultados', noJugandoCount);
console.log('📊 Stats locales - Jugando:', jugandoCount, '| No jugando:', noJugandoCount);
}
document.addEventListener('visibilitychange', () => {
if (!document.hidden) {
console.log('👀 Usuario regresó a la app');
statsCache.lastUpdate = 0;
updateHeroStats();
}
});
setInterval(() => {
if (!document.hidden) {
updateHeroStats();
}
}, 10000);
/* = Navegación principal segunda parte = */
function navigateTo(page) {
console.log("Navegando a:", page);
if (!pages || pages.length === 0) {
console.error("No hay elementos .page en el DOM");
return;
}
pages.forEach(function(p) { p.classList.remove("active"); });
const targetPageId = "page" + page.charAt(0).toUpperCase() + page.slice(1);
const targetPage = document.getElementById(targetPageId);
if (!targetPage) {
console.error("No se encontró la página:", targetPageId);
return;
}
targetPage.classList.add("active");
updateHero(page);
updateHeroStats();
window.scrollTo({ top: 0, behavior: "smooth" });
if (navItems && navItems.length > 0) {
navItems.forEach(function(nav) { nav.classList.remove("active"); });
const activeNavItem = document.querySelector('[data-page="' + page + '"]');
if (activeNavItem) activeNavItem.classList.add("active");
}
if (page === "quiniela") {
if (typeof renderQuinielaMatches === "function") renderQuinielaMatches();
if (typeof updateQuinielaCount === "function") updateQuinielaCount();
if (typeof updatePrice === "function") updatePrice();
}
if (page === "analisis") {
const firstTab = document.querySelector('#pageAnalisis .tab-btn[data-tab="horarios"]');
const firstContent = document.getElementById("tabHorarios");
document.querySelectorAll("#pageAnalisis .tab-btn").forEach(function(btn) {
btn.classList.remove("active");
});
document.querySelectorAll("#pageAnalisis .tab-content").forEach(function(content) {
content.classList.remove("active");
});
if (firstTab) firstTab.classList.add("active");
if (firstContent) firstContent.classList.add("active");
if (typeof renderMatchesHorarios === "function") renderMatchesHorarios();
if (typeof renderMatchesPorcentajes === "function") renderMatchesPorcentajes();
}
if (page === "resultados") {
const firstTab = document.querySelector('#pageResultados .tab-btn[data-tab="misQuinielasJugadas"]');
const firstContent = document.getElementById("tabMisQuinielas");
document.querySelectorAll("#pageResultados .tab-btn").forEach(function(btn) {
btn.classList.remove("active");
});
document.querySelectorAll("#pageResultados .tab-content").forEach(function(content) {
content.classList.remove("active");
});
if (firstTab) firstTab.classList.add("active");
if (firstContent) firstContent.classList.add("active");
if (typeof renderMyQuinielas === "function") {
console.log("Llamando renderMyQuinielas desde navigateTo");
renderMyQuinielas();
}
}
if (page === "admin") {
setTimeout(function() {
try { actualizarContadorTotal(); } catch(e) {}
try { actualizarJornadaActual(); } catch(e) {}
if (typeof mostrarAdminTab === "function") mostrarAdminTab('pendientes');
}, 100);
}
}
function mostrarAdminTab(tab) {
const seccionPendientes = document.getElementById('adminPendientes');
const seccionEspera = document.getElementById('adminEspera');
const seccionJugando = document.getElementById('adminJugando');
if (!seccionPendientes || !seccionEspera || !seccionJugando) {
console.warn('⚠️ Faltan secciones del admin');
return;
}
seccionPendientes.style.display = (tab === 'pendientes') ? 'block' : 'none';
seccionEspera.style.display = (tab === 'espera') ? 'block' : 'none';
seccionJugando.style.display = (tab === 'jugando') ? 'block' : 'none';
const botones = document.querySelectorAll('#pageAdmin .filter-btn');
botones.forEach(function(btn) {
const filtro = btn.getAttribute('data-filter');
if (filtro === tab) {
btn.classList.add('active');
} else {
btn.classList.remove('active');
}
});
if (tab === 'pendientes' && typeof cargarPendientesTabla === 'function') {
cargarPendientesTabla();
} else if (tab === 'espera' && typeof cargarEsperaTabla === 'function') {
cargarEsperaTabla();
} else if (tab === 'jugando' && typeof cargarJugandoTabla === 'function') {
cargarJugandoTabla();
}
}
document.addEventListener('click', function(e) {
const btn = e.target.closest('.filter-btn[data-filter]');
if (!btn) return;
const tab = btn.getAttribute('data-filter');
if (tab && typeof mostrarAdminTab === 'function') {
mostrarAdminTab(tab);
}
});
/* = Esto de abajo trabaja en la jornada actual= */
async function cargarJornadaActual() {
try {
const data = await fetchAPI("/jornada-actual");
if (!data) {
console.log("No se pudo cargar la jornada actual");
return;
}
window.jornadaActual = data;
actualizarJornada();
console.log("Jornada actual:", data.inicio, "->", data.fin);
} catch (err) {
console.error("Error al cargar la jornada actual", err);
}
}
function actualizarJornada() {
if (!window.jornadaActual) {
console.log("Jornada actual no cargada todavía");
return;
}
const badges = document.querySelectorAll(".jornada-badge");
badges.forEach(function(badge) {
badge.textContent = window.jornadaActual.nombre + " Liga MX";
});
const grupoLink = document.querySelector(".grupo-jornada");
const grupoTexto = document.querySelector(".texto-grupo-jornada");
if (grupoLink) {
grupoLink.href = window.jornadaActual.link_grupo;
}
if (grupoTexto) {
grupoTexto.textContent =
"Únete al grupo de WhatsApp " + window.jornadaActual.codigo_grupo;
}
}
cargarJornadaActual();
/* = Esto de abajo trabaja en la Lista Oficial = */
let officialResults = {};
let participants = [];
let dataLoaded = false;
let resumen = {};
async function loadDataFromAPI() {
if (dataLoaded) return true;
try {
const [resOficial, resResultados] = await Promise.all([
fetch(API_BASE + "/api/lista-oficial"),
fetch(API_BASE + "/api/resultados-oficiales")
]);
if (!resOficial.ok || !resResultados.ok) {
throw new Error("Error al cargar datos del servidor");
}
const dataOficial = await resOficial.json();
const dataResultados = await resResultados.json();
const resultadosObj = dataResultados.resultados || {};
const quinielas = dataOficial.quinielas || [];
officialResults = resultadosObj;
participants = quinielas.map(function(j) {
let puntos = 0;
(j.picks || []).forEach(function(pick, i) {
if (resultadosObj[String(i)] && pick === resultadosObj[String(i)]) puntos++;
});
return {
id: j.folio,
name: j.nombre,
vendor: j.vendedor,
predictions: j.picks,
points: puntos
};
});
const sorted = [...participants].sort(function(a, b) { return b.points - a.points; });
const fp = sorted.length > 0 ? sorted[0].points : 0;
const sp = sorted.find(function(p) { return p.points < fp; });
resumen = {
total_participantes: participants.length,
first_place_points: fp,
first_place_count: sorted.filter(function(p) { return p.points === fp; }).length,
second_place_points: sp ? sp.points : 0,
second_place_count: sp ? sorted.filter(function(p) { return p.points === sp.points; }).length : 0
};
console.log("Lista Oficial cargada ✅ :", {
participantes: participants.length,
primer_lugar: resumen.first_place_count,
segundo_lugar: resumen.second_place_count
});
dataLoaded = true;
return true;
} catch (error) {
console.error("Error al cargar Lista Oficial ❌:", error);
showToast("Error al cargar Lista Oficial ❌", "error");
return false;
}
}
function renderMatchesHeader() {
const headerCells = document.querySelectorAll("#tabListaGeneral .results-table thead .col-match, #admin-quinielas-jugando .results-table thead .col-match");
headerCells.forEach(function(th) {
const index = parseInt(th.dataset.matchIndex, 10);
const partido = partidos[index - 1];
if (!partido) return;
th.innerHTML =
'<div class="match-header">' +
'<img src="' + partido.localLogo + '" alt="' + partido.local + '" class="match-logo">' +
'<span class="match-vs">vs</span>' +
'<img src="' + partido.visitanteLogo + '" alt="' + partido.visitante + '" class="match-logo">' +
"</div>";
});
}
const quiniela = {
renderResults: function() {
const tbody = document.getElementById("resultsBody");
if (!tbody) return;
if (!participants.length) {
tbody.innerHTML = "";
return;
}
const firstPoints = participants[0] ? participants[0].points : 0;
const secondObj = participants.find(function(p) { return p.points < firstPoints; });
const secondPoints = secondObj ? secondObj.points : 0;
tbody.innerHTML = participants.map(function(p) {
const isFirst = p.points === firstPoints;
const isSecond = !isFirst && p.points === secondPoints;
const pointsClass = isFirst ? "points-gold" : (isSecond ? "points-silver" : "points-normal");
const matchesHtml = partidos.map(function(partido) {
const res = p.predictions[partido.id] || "";
const resultadoOficial = officialResults[String(partido.id)] || "";
const cls = !resultadoOficial
? "pending"
: (res && res === resultadoOficial ? "correct" : "incorrect");
return '<td class="col-match"><span class="result-cell ' + cls + '">' + (res || "-") + "</span></td>";
}).join("");
return (
"<tr>" +
'<td class="col-folio">' + (p.id || "-") + "</td>" +
'<td class="col-name">' + p.name + "</td>" +
'<td class="col-vendor">' + (p.vendor || "-") + "</td>" +
matchesHtml +
'<td class="col-points"><span class="points-cell ' + pointsClass + '">' + p.points + "</span></td>" +
"</tr>"
);
}).join("");
},
updateSummary: function() {
if (!resumen || !resumen.total_participantes) return;
const firstPlaceCountEl = document.getElementById("firstPlaceCount");
const secondPlaceCountEl = document.getElementById("secondPlaceCount");
const totalCountEl = document.getElementById("totalCount");
const firstPlaceTotalEl = document.getElementById("firstPlaceTotal");
const firstPlacePointsEl = document.getElementById("firstPlacePoints");
const secondPlaceTotalEl = document.getElementById("secondPlaceTotal");
const secondPlacePointsEl = document.getElementById("secondPlacePoints");
if (firstPlaceCountEl) firstPlaceCountEl.textContent = resumen.first_place_count;
if (secondPlaceCountEl) secondPlaceCountEl.textContent = resumen.second_place_count;
if (totalCountEl) totalCountEl.textContent = resumen.total_participantes;
if (firstPlaceTotalEl) firstPlaceTotalEl.textContent = resumen.first_place_count;
if (firstPlacePointsEl) {
firstPlacePointsEl.textContent = resumen.first_place_points === 1
? "Con 1 punto"
: "Con " + resumen.first_place_points + " puntos";
}
if (secondPlaceTotalEl) secondPlaceTotalEl.textContent = resumen.second_place_count;
if (secondPlacePointsEl) {
if (!resumen.second_place_count) {
secondPlacePointsEl.textContent = "Sin segundo lugar";
} else if (resumen.second_place_points === 1) {
secondPlacePointsEl.textContent = "Con 1 punto";
} else {
secondPlacePointsEl.textContent = "Con " + resumen.second_place_points + " puntos";
}
}
},
renderWinnersList: async function(targetId, place) {
if (place === undefined) place = "first";
const container = document.getElementById(targetId);
if (!container) return;
try {
const [resOficial, resResultados] = await Promise.all([
fetch(API_BASE + '/api/lista-oficial'),
fetch(API_BASE + '/api/resultados-oficiales')
]);
if (!resOficial.ok || !resResultados.ok) {
throw new Error('Error al cargar datos');
}
const dataOficial = await resOficial.json();
const dataResultados = await resResultados.json();
const quinielas = dataOficial.quinielas || [];
const resultadosObj = dataResultados.resultados || {};
if (!quinielas.length) {
container.innerHTML = '';
if (place === "first") {
const firstPlaceTotalEl = document.getElementById("firstPlaceTotal");
const firstPlacePointsEl = document.getElementById("firstPlacePoints");
if (firstPlaceTotalEl) firstPlaceTotalEl.textContent = '0';
if (firstPlacePointsEl) firstPlacePointsEl.textContent = 'Sin participantes';
} else {
const secondPlaceTotalEl = document.getElementById("secondPlaceTotal");
const secondPlacePointsEl = document.getElementById("secondPlacePoints");
if (secondPlaceTotalEl) secondPlaceTotalEl.textContent = '0';
if (secondPlacePointsEl) secondPlacePointsEl.textContent = 'Sin segundo lugar';
}
return;
}
const quinielasConPuntos = quinielas.map(function(q) {
let puntos = 0;
(q.picks || []).forEach(function(pick, i) {
if (resultadosObj[String(i)] && pick === resultadosObj[String(i)]) puntos++;
});
return {
nombre: q.nombre || 'Sin nombre',
vendedor: q.vendedor || 'Sin vendedor',
folio: q.folio || 'Sin folio',
puntos: puntos
};
});
quinielasConPuntos.sort(function(a, b) { return b.puntos - a.puntos; });
const firstPoints = quinielasConPuntos.length > 0 ? quinielasConPuntos[0].puntos : 0;
const secondObj = quinielasConPuntos.find(function(q) { return q.puntos < firstPoints; });
const secondPoints = secondObj ? secondObj.puntos : 0;
let winners = [];
if (place === "first") {
winners = quinielasConPuntos.filter(function(q) { return q.puntos === firstPoints; });
} else {
winners = secondPoints > 0 ? quinielasConPuntos.filter(function(q) { return q.puntos === secondPoints; }) : [];
}
if (place === "first") {
const firstPlaceTotalEl = document.getElementById("firstPlaceTotal");
const firstPlacePointsEl = document.getElementById("firstPlacePoints");
if (firstPlaceTotalEl) firstPlaceTotalEl.textContent = winners.length;
if (firstPlacePointsEl) {
firstPlacePointsEl.textContent = firstPoints === 1
? "Con 1 punto"
: "Con " + firstPoints + " puntos";
}
} else {
const secondPlaceTotalEl = document.getElementById("secondPlaceTotal");
const secondPlacePointsEl = document.getElementById("secondPlacePoints");
if (secondPlaceTotalEl) secondPlaceTotalEl.textContent = winners.length;
if (secondPlacePointsEl) {
if (!winners.length) {
secondPlacePointsEl.textContent = "Sin segundo lugar";
} else if (secondPoints === 1) {
secondPlacePointsEl.textContent = "Con 1 punto";
} else {
secondPlacePointsEl.textContent = "Con " + secondPoints + " puntos";
}
}
}
container.innerHTML = winners.map(function(w) {
return (
'<div class="winner-card">' +
'<div class="winner-folio">Folio: ' + w.folio + '</div>' +
'<div class="winner-name">' + w.nombre + '</div>' +
'<div class="winner-vendor">' + w.vendedor + '</div>' +
'<div class="winner-points">' + w.puntos + (w.puntos === 1 ? ' punto' : ' puntos') + '</div>' +
'</div>'
);
}).join('');
} catch (error) {
console.error('❌ Error en podio:', error);
container.innerHTML = '';
if (place === "first") {
const firstPlaceTotalEl = document.getElementById("firstPlaceTotal");
const firstPlacePointsEl = document.getElementById("firstPlacePoints");
if (firstPlaceTotalEl) firstPlaceTotalEl.textContent = '0';
if (firstPlacePointsEl) firstPlacePointsEl.textContent = 'Error al cargar';
} else {
const secondPlaceTotalEl = document.getElementById("secondPlaceTotal");
const secondPlacePointsEl = document.getElementById("secondPlacePoints");
if (secondPlaceTotalEl) secondPlaceTotalEl.textContent = '0';
if (secondPlacePointsEl) secondPlacePointsEl.textContent = 'Error al cargar';
}
}
},
initFirstPlacePage: async function() {
await this.renderWinnersList("firstPlaceList", "first");
this.updateSummary();
},
initSecondPlacePage: async function() {
await this.renderWinnersList("secondPlaceList", "second");
this.updateSummary();
},
/* = Esto de abajo trabaja en el verificador de la quiniela (Lista Oficial) = */
searchParticipant: async function() {
const input = document.getElementById("searchInput");
const resultsContainer = document.getElementById("searchResults");
if (!input || !resultsContainer) return;
const term = input.value.trim().toLowerCase();
if (!term) {
resultsContainer.innerHTML =
'<div class="no-results">' +
'<span class="no-results-icon">🔎</span>' +
"<p>Buscar jugada</p>" +
"</div>";
return;
}
try {
const [responseOficial, responseResultados] = await Promise.all([
fetch(API_BASE + '/api/lista-oficial'),
fetch(API_BASE + '/api/resultados-oficiales')
]);
if (!responseOficial.ok || !responseResultados.ok) {
throw new Error('Error al cargar datos');
}
const dataOficial = await responseOficial.json();
const dataResultados = await responseResultados.json();
const quinielas = dataOficial.quinielas || [];
const resultadosObj = dataResultados.resultados || {};
console.log('🔍 Buscando en', quinielas.length, 'quinielas');
console.log('🔍 Resultados oficiales:', resultadosObj);
if (!quinielas.length) {
resultsContainer.innerHTML =
'<div class="no-results">' +
'<span class="no-results-icon">❌</span>' +
"<p>No hay jugadas cargadas.</p>" +
"</div>";
return;
}
const termNorm = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const quinielasConPuntos = quinielas.map(function(q) {
let puntos = 0;
(q.picks || []).forEach(function(pick, i) {
const resultado = resultadosObj[String(i)];
if (resultado && pick && pick === resultado) puntos++;
});
return {
id: q.id,
nombre: q.nombre || 'Sin nombre',
vendedor: q.vendedor || 'Sin vendedor',
folio: q.folio || 'Sin folio',
picks: q.picks || [],
puntos: puntos
};
});
quinielasConPuntos.sort(function(a, b) { return b.puntos - a.puntos; });
const firstPoints = quinielasConPuntos.length > 0 ? quinielasConPuntos[0].puntos : 0;
const secondObj = quinielasConPuntos.find(function(q) { return q.puntos < firstPoints; });
const secondPoints = secondObj ? secondObj.puntos : 0;
const filteredConPuntos = quinielasConPuntos.filter(function(q) {
const name = q.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const vendor = q.vendedor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const folio = q.folio.toString().toLowerCase();
return name.includes(termNorm) || vendor.includes(termNorm) || folio.includes(term);
});
console.log('✅ Encontrados:', filteredConPuntos.length);
if (!filteredConPuntos.length) {
resultsContainer.innerHTML =
'<div class="no-results">' +
'<span class="no-results-icon">😔</span>' +
'<p>No se encontró "' + input.value + '"</p>' +
"</div>";
return;
}
resultsContainer.innerHTML = filteredConPuntos.map(function(q) {
const isFirst = q.puntos === firstPoints && firstPoints > 0;
const isSecond = !isFirst && q.puntos === secondPoints && secondPoints > 0;
const placeClass = isFirst ? "first-place" : (isSecond ? "second-place" : "");
const puntosTexto = q.puntos === 1 ? "1 Punto" : (q.puntos + " Puntos");
const predictionsHtml = partidos.map(function(partido, idx) {
const res = (q.picks && q.picks[idx]) ? q.picks[idx] : "-";
const resultOficial = resultadosObj[String(idx)] || "";
const isCorrect = resultOficial && res === resultOficial;
const cellClass = isCorrect ? "correct" : (resultOficial ? "incorrect" : "");
return (
'<div class="verify-item ' + cellClass + '">' +
'<span class="match-result">' + res + "</span>" +
"</div>"
);
}).join("");
return (
'<div class="verify-card ' + placeClass + '">' +
'<div class="verify-header">' +
"<div>" +
"<h4>" + q.nombre + "</h4>" +
"<p>Vendedor: " + q.vendedor + "</p>" +
"</div>" +
'<div class="verify-points"><span>' + puntosTexto + "</span></div>" +
"</div>" +
'<div class="verify-predictions">' + predictionsHtml + "</div>" +
'<div class="verify-folio">Folio: ' + q.folio + "</div>" +
"</div>"
);
}).join("");
} catch (error) {
console.error('❌ Error en verificar:', error);
resultsContainer.innerHTML =
'<div class="no-results">' +
'<span class="no-results-icon">❌</span>' +
"<p>Error al cargar datos</p>" +
"</div>";
}
}
};
/* = Esto de abajo trabaja en el simulador de la quiniela = */
const simulador = {
simState: [],
quinielasCache: [],
partidos: [],
init: async function() {
try {
const responseOficial = await fetch(`${API_BASE}/api/lista-oficial`);
if (!responseOficial.ok) {
throw new Error('Error al cargar datos');
}
const dataOficial = await responseOficial.json();
this.partidos = partidos;
this.quinielasCache = dataOficial.quinielas || [];
this.simState = new Array(this.partidos.length).fill("-");
this.renderGrid();
this.renderResults();
this.updateSummary();
const resetBtn = document.getElementById("resetSimulation");
if (resetBtn) {
const self = this;
resetBtn.onclick = function() {
self.reset();
};
}
} catch (error) {
console.error('❌ Error iniciando simulador:', error);
const grid = document.getElementById("simulationGrid");
if (grid) {
grid.innerHTML = '<div style="text-align:center; padding:40px; color:#ff0000;">❌ Error al cargar simulador</div>';
}
}
},
renderGrid: function() {
const grid = document.getElementById("simulationGrid");
if (!grid) return;
const self = this;
grid.innerHTML = this.partidos.map(function(partido, index) {
const selectedL = self.simState[index] === "L" ? " selected" : "";
const selectedE = self.simState[index] === "E" ? " selected" : "";
const selectedV = self.simState[index] === "V" ? " selected" : "";
return (
'<div class="sim-match-card">' +
'<div class="sim-match-row">' +
'<button class="sim-result-btn' + selectedL + '" data-index="' + index + '" data-result="L">L</button>' +
'<div class="sim-team-inline">' +
'<img src="' + partido.localLogo + '" alt="' + partido.local + '">' +
"<span>" + partido.local + "</span>" +
"</div>" +
'<button class="sim-result-btn' + selectedE + '" data-index="' + index + '" data-result="E">E</button>' +
'<div class="sim-team-inline right">' +
"<span>" + partido.visitante + "</span>" +
'<img src="' + partido.visitanteLogo + '" alt="' + partido.visitante + '">' +
"</div>" +
'<button class="sim-result-btn' + selectedV + '" data-index="' + index + '" data-result="V">V</button>' +
"</div>" +
"</div>"
);
}).join("");
grid.querySelectorAll(".sim-result-btn").forEach(function(btn) {
btn.addEventListener("click", function() {
const index = parseInt(btn.dataset.index, 10);
const result = btn.dataset.result;
const row = btn.parentElement;
row.querySelectorAll(".sim-result-btn").forEach(function(b) {
b.classList.remove("selected");
});
btn.classList.add("selected");
self.simState[index] = result;
self.renderResults();
self.updateSummary();
});
});
},
calculatePoints: function(picks) {
if (!Array.isArray(picks)) return 0;
let points = 0;
const self = this;
picks.forEach(function(pick, index) {
const simResult = self.simState[index];
if (simResult !== "-" && pick === simResult) points++;
});
return points;
},
getRanked: function() {
if (!Array.isArray(this.quinielasCache) || this.quinielasCache.length === 0) return [];
const self = this;
return this.quinielasCache
.map(function(q) {
return {
folio: q.folio,
nombre: q.nombre,
vendedor: q.vendedor,
picks: q.picks,
puntos: self.calculatePoints(q.picks)
};
})
.sort(function(a, b) {
if (b.puntos !== a.puntos) return b.puntos - a.puntos;
return String(a.folio).localeCompare(String(b.folio));
});
},
renderResults: function() {
const tbody = document.getElementById("simulationResultsBody");
if (!tbody) return;
const ranked = this.getRanked();
if (!ranked.length) {
tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center;">No hay datos para simular</td></tr>';
return;
}
const firstPoints = ranked[0] ? ranked[0].puntos : 0;
const secondObj = ranked.find(function(r) { return r.puntos < firstPoints; });
const secondPoints = secondObj ? secondObj.puntos : 0;
const self = this;
tbody.innerHTML = ranked.map(function(q) {
const isFirst = q.puntos === firstPoints;
const isSecond = !isFirst && q.puntos === secondPoints;
const pointsClass = isFirst ? "points-gold" : (isSecond ? "points-silver" : "points-normal");
const matchesHtml = q.picks.map(function(pick, idx) {
const simResult = self.simState[idx];
const cls = simResult === "-"
? "pending"
: (pick === simResult ? "correct" : "incorrect");
return '<td class="col-match"><span class="result-cell ' + cls + '">' + pick + "</span></td>";
}).join("");
return (
"<tr>" +
'<td class="col-folio">' + q.folio + "</td>" +
'<td class="col-name">' + q.nombre + "</td>" +
'<td class="col-vendor">' + q.vendedor + "</td>" +
matchesHtml +
'<td class="col-points"><span class="points-cell ' + pointsClass + '">' + q.puntos + "</span></td>" +
"</tr>"
);
}).join("");
},
updateSummary: function() {
const ranked = this.getRanked();
if (!ranked.length) return;
const firstPoints = ranked[0].puntos;
const firstCount = ranked.filter(function(q) { return q.puntos === firstPoints; }).length;
const secondPlace = ranked.find(function(q) { return q.puntos < firstPoints; });
const secondCount = secondPlace
? ranked.filter(function(q) { return q.puntos === secondPlace.puntos; }).length
: 0;
const simFirstPlace = document.getElementById("simFirstPlace");
const simSecondPlace = document.getElementById("simSecondPlace");
const simTotal = document.getElementById("simTotal");
if (simFirstPlace) simFirstPlace.textContent = firstCount;
if (simSecondPlace) simSecondPlace.textContent = secondCount;
if (simTotal) simTotal.textContent = ranked.length;
},
reset: function() {
this.simState = new Array(this.partidos.length).fill("-");
this.renderGrid();
this.renderResults();
this.updateSummary();
}
};
/* = Funciones de Horarios = */
function renderMatchesHorarios() {
const container = document.getElementById("matchesHorarios");
if (!container) return;
container.innerHTML = partidos.map(function(partido) {
return '<div class="match-card">' +
'<div class="match-league" style="text-align: center;">' +
"<span>" + partido.horario + "</span>" +
"</div>" +
'<div class="match-teams">' +
'<div class="match-team">' +
'<img src="' + partido.localLogo + '" alt="' + partido.local + '" class="team-logo">' +
"<span>" + partido.local + "</span>" +
"</div>" +
'<div class="match-vs">VS</div>' +
'<div class="match-team">' +
'<img src="' + partido.visitanteLogo + '" alt="' + partido.visitante + '" class="team-logo">' +
"<span>" + partido.visitante + "</span>" +
"</div>" +
"</div>" +
'<div class="match-info" style="justify-content: center;">' +
"<span>" +
'<img src="' + partido.televisionLogo + '" alt="' + partido.televisora + '" style="width: 44px; height: 44px;">' +
"</span>" +
"</div>" +
"</div>";
}).join("");
}
/* = Porcentajes en tiempo real basados en Lista Oficial = */
let quinielasOficiales = [];
async function cargarPorcentajes() {
try {
const response = await fetch(`${API_BASE}/api/lista-oficial`);
const data = await response.json();
quinielasOficiales = data.quinielas || [];
console.log('✅ Porcentajes actualizados:', quinielasOficiales.length, 'participantes');
renderMatchesPorcentajes();
} catch (error) {
console.error('❌ Error al cargar porcentajes:', error);
quinielasOficiales = [];
renderMatchesPorcentajes();
}
}
function calculateRealPercentages() {
if (!Array.isArray(quinielasOficiales) || quinielasOficiales.length === 0) {
return partidos.map(() => ({ L: 0, E: 0, V: 0, total: 0 }));
}
return partidos.map((partido, index) => {
let countL = 0;
let countE = 0;
let countV = 0;
quinielasOficiales.forEach(quiniela => {
const pick = quiniela.picks[index];
if (pick === "L") countL++;
else if (pick === "E") countE++;
else if (pick === "V") countV++;
});
const total = countL + countE + countV;
if (total === 0) {
return { L: 0, E: 0, V: 0, total: 0 };
}
return {
L: Math.round((countL / total) * 100),
E: Math.round((countE / total) * 100),
V: Math.round((countV / total) * 100),
total: total
};
});
}
function getMostFavored(percentages) {
const max = Math.max(percentages.L, percentages.E, percentages.V);
const min = Math.min(percentages.L, percentages.E, percentages.V);
return {
most: max,
least: min,
isLMost: percentages.L === max,
isEMost: percentages.E === max,
isVMost: percentages.V === max,
isLLeast: percentages.L === min,
isELeast: percentages.E === min,
isVLeast: percentages.V === min
};
}
function renderMatchesPorcentajes() {
const container = document.getElementById("matchesPorcentajes");
if (!container) return;
const realPercentages = calculateRealPercentages();
const totalQuinielas = quinielasOficiales.length;
container.innerHTML = partidos.map((partido, index) => {
const perc = realPercentages[index];
const favored = getMostFavored(perc);
const localClass = favored.isLMost ? "local" : (favored.isLLeast ? "visita" : "empate");
const empateClass = "empate";
const visitaClass = favored.isVMost ? "local" : (favored.isVLeast ? "visita" : "empate");
return `
<div class="match-card">
<div class="match-league" style="text-align: center; margin-bottom: 8px;">
<span style="font-size: 0.7rem; color: var(--gray-700); font-weight: 500;">
Basado en la lista de participantes 📊 
</span>
</div>
<div class="match-teams">
<div class="match-team">
<img src="${partido.localLogo}" alt="${partido.local}" class="team-logo">
<span>${partido.local}</span>
</div>
<div class="match-vs">VS</div>
<div class="match-team">
<img src="${partido.visitanteLogo}" alt="${partido.visitante}" class="team-logo">
<span>${partido.visitante}</span>
</div>
</div>
<div class="match-percentages">
<div class="percentage-item">
<span class="percentage-label">L</span>
<div class="percentage-bar">
<div class="percentage-fill ${localClass}" style="width: ${perc.L}%"></div>
</div>
<span class="percentage-value">${perc.L}%</span>
</div>
<div class="percentage-item">
<span class="percentage-label">E</span>
<div class="percentage-bar">
<div class="percentage-fill ${empateClass}" style="width: ${perc.E}%"></div>
</div>
<span class="percentage-value">${perc.E}%</span>
</div>
<div class="percentage-item">
<span class="percentage-label">V</span>
<div class="percentage-bar">
<div class="percentage-fill ${visitaClass}" style="width: ${perc.V}%"></div>
</div>
<span class="percentage-value">${perc.V}%</span>
</div>
</div>
</div>
`;
}).join("");
}
/* = Funciones de Quiniela-Esto de abajo trabaja en la quiniela guardada. = */
function showSaved() {
if (!savedQuinielas || savedQuinielas.length === 0) {
openModal(`
<div style="text-align: center; padding: 30px 0;">
<span style="font-size: 3rem; display: block; margin-bottom: 16px;">📋</span>
<p style="color: #9ca3af;">No tienes quinielas guardadas</p>
</div>
`);
return;
}
const count = savedQuinielas.length;
const pricePerQuiniela = count >= 10 ? 25 : 30;
const total = count * pricePerQuiniela;
const quinielasHtml = savedQuinielas.map((q, index) => {
if (!q || !q.predictions) return "";
const miniQuinielaHtml = partidos.map(partido => {
const preds = q.predictions[partido.id];
const localSelected = preds && preds.includes("L");
const empateSelected = preds && preds.includes("E");
const visitaSelected = preds && preds.includes("V");
return `
<div style="display: flex; align-items: center; gap: 2px; padding: 2px 0;">
<button style="width: 24px; height: 24px; min-width: 24px; min-height: 24px; border: 1px solid ${localSelected ? "#006847" : "#d1d5db"}; border-radius: 3px; font-size: 0.65rem; font-weight: 700; cursor: default; background: ${localSelected ? "#006847" : "#ffffff"}; color: ${localSelected ? "white" : "#6b7280"}; flex-shrink: 0; padding: 0; display: flex; align-items: center; justify-content: center;">L</button>
<div style="flex: 1; display: flex; align-items: center; gap: 2px; font-size: 0.6rem; color: #374151; min-width: 0;">
<img src="${partido.localLogo}" style="width: 14px; height: 14px; object-fit: contain; flex-shrink: 0;">
<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${partido.local}</span>
</div>
<button style="width: 24px; height: 24px; min-width: 24px; min-height: 24px; border: 1px solid ${empateSelected ? "#006847" : "#d1d5db"}; border-radius: 3px; font-size: 0.65rem; font-weight: 700; cursor: default; background: ${empateSelected ? "#006847" : "#ffffff"}; color: ${empateSelected ? "white" : "#6b7280"}; flex-shrink: 0; padding: 0; display: flex; align-items: center; justify-content: center;">E</button>
<div style="flex: 1; display: flex; align-items: center; gap: 2px; font-size: 0.6rem; justify-content: flex-end; color: #374151; min-width: 0;">
<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right;">${partido.visitante}</span>
<img src="${partido.visitanteLogo}" style="width: 14px; height: 14px; object-fit: contain; flex-shrink: 0;">
</div>
<button style="width: 24px; height: 24px; min-width: 24px; min-height: 24px; border: 1px solid ${visitaSelected ? "#006847" : "#d1d5db"}; border-radius: 3px; font-size: 0.65rem; font-weight: 700; cursor: default; background: ${visitaSelected ? "#006847" : "#ffffff"}; color: ${visitaSelected ? "white" : "#6b7280"}; flex-shrink: 0; padding: 0; display: flex; align-items: center; justify-content: center;">V</button>
</div>
`;
}).join("");
const folioText = ""; 
return `
<div style="background: #ffffff; padding: 10px; border-radius: 10px; margin-bottom: 10px; border: 2px solid #e5e7eb; max-width: 580px; width: 100%;">
<div style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb;">
<div style="font-size: 0.9rem; font-weight: 700; color: #1f2937; margin-bottom: 2px;">${q.name || "Sin nombre"}</div>
<div style="font-size: 0.65rem; color: #6b7280;">Vendedor: ${q.vendedor || currentVendedor} • ${jornadaActual.nombre}</div>
${folioText}
</div>
${miniQuinielaHtml}
<button onclick="deleteQuiniela(${index})" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 600; width: 100%; margin-top: 6px;">Eliminar 🗑️</button>
</div>
`;
}).join("");
openModal(`
<div style="display: flex; flex-direction: column; align-items: center;">
${quinielasHtml}
<div style="background: #006847; padding: 10px 16px; border-radius: 12px; text-align: center; width: 100%; max-width: 580px; margin-top: 10px;">
<div style="font-size: 0.9rem; color: white; font-weight: 600;">Quinielas guardadas: ${count}</div>
<div style="font-size: 0.9rem; color: white; font-weight: 600;">Total: $${total}</div>
</div>
</div>
`);
}
function sendQuiniela() {
if (!savedQuinielas || savedQuinielas.length === 0) {
showErrorModal("No tienes quinielas guardadas para enviar ❌");
return;
}
const count = savedQuinielas.length;
const pricePerQuiniela = count >= 10 ? 25 : 30;
const totalPrice = count * pricePerQuiniela;
const modal = document.createElement("div");
modal.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;";
modal.innerHTML = `
<div style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border-radius: 20px; padding: 25px; max-width: 350px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); border: 3px solid #006847; text-align: center;">
<div style="font-size: 80px; margin-bottom: 15px;">📲</div>
<h2 style="color: #006847; margin: 0 0 10px 0; font-size: 22px; font-weight: 800;">Enviar por WhatsApp</h2>
<div style="background: #f8f9fa; padding: 15px; border-radius: 12px; margin: 15px 0;">
<div style="color: #666; font-size: 13px; margin-bottom: 8px;"><strong>${count}</strong> quiniela${count !== 1 ? "s" : ""} guardada${count !== 1 ? "s" : ""} 📋</div>
<div style="color: #006847; font-size: 24px; font-weight: 900;">$${totalPrice}</div>
</div>
<p style="color: #666; font-size: 13px; margin: 15px 0;">Se enviarán tus quinielas por WhatsApp ⚠️</p>
<button class="btn-enviar-confirmar" style="width: 100%; padding: 14px; margin-bottom: 10px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4);">Enviar ahora ✓</button>
<button class="btn-cancelar" style="width: 100%; padding: 12px; background: transparent; color: #999; border: 2px solid #ddd; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">Cancelar</button>
</div>
`;
document.body.appendChild(modal);
modal.querySelector(".btn-enviar-confirmar").addEventListener("click", () => {
modal.remove();
procesarEnvioWhatsApp(savedQuinielas, totalPrice);
});
modal.querySelector(".btn-cancelar").addEventListener("click", () => {
modal.remove();
});
}
/* = Esto de abajo trabaja en quinielas enviadas a la seccion Jugadas = */
function calcularPuntosQuiniela(predictionsObj) {
let puntos = 0;
if (!officialResults || Object.keys(officialResults).length === 0) {
return 0;
}
partidos.forEach(function(partido, index) {
const userPickArr = predictionsObj[partido.id];
const userPick = Array.isArray(userPickArr) ? userPickArr[0] : userPickArr;
const resultado = officialResults[String(index)];
if (resultado && userPick && resultado === userPick) {
puntos++;
}
});
return puntos;
}
function buscarQuinielaEnLista(quinielaSent) {
if (!Array.isArray(participants) || participants.length === 0) {
return null;
}
const candidatosPorNombre = participants.filter(function(p) {
return p.name.trim().toLowerCase() === quinielaSent.name.trim().toLowerCase();
});
if (candidatosPorNombre.length === 0) {
console.log('❌ No se encontró: ' + quinielaSent.name);
return null;
}
let candidatosFinales = candidatosPorNombre;
if (candidatosPorNombre.length > 1) {
const conVendedor = candidatosPorNombre.filter(function(p) {
return p.vendor.trim().toLowerCase() === quinielaSent.vendedor.trim().toLowerCase();
});
if (conVendedor.length > 0) {
candidatosFinales = conVendedor;
console.log('🔍 ' + conVendedor.length + ' candidato(s) con nombre+vendedor');
}
}
console.log('🔍 Validando picks para "' + quinielaSent.name + '"...');
for (const candidato of candidatosFinales) {
const todosCoinciden = partidos.every(function(partido, index) {
const pickSentArr = quinielaSent.predictions[partido.id];
const pickSent = Array.isArray(pickSentArr) ? pickSentArr[0] : pickSentArr;
const pickLista = candidato.predictions[index];
if (!pickSent || !pickLista) return true;
return pickSent.trim().toUpperCase() === pickLista.trim().toUpperCase();
});
if (todosCoinciden) {
console.log('✅ MATCH COMPLETO: ' + quinielaSent.name + ' → Folio: ' + candidato.id);
return candidato;
}
}
console.log('❌ NO MATCH: Nombre encontrado pero picks NO coinciden');
return null;
}
async function actualizarEstadosDesdeBackend() {
try {
const vendedor = currentVendedor || localStorage.getItem('vendedor');
if (!vendedor) {
console.warn('⚠️ No hay vendedor para consultar');
return;
}
const response = await fetch(`${API_BASE}/api/quinielas?vendedor=${encodeURIComponent(vendedor)}&jornada=${encodeURIComponent((jornadaActual && jornadaActual.nombre) || '')}`);
if (!response.ok) {
console.warn('⚠️ Error al consultar backend:', response.status);
return;
}
const data = await response.json();
if (!data.success || !data.quinielas) {
console.warn('⚠️ Respuesta inválida del backend');
return;
}
console.log('🔄 Sincronizando con backend...');
console.log('📊 Backend: ' + data.quinielas.length + ' | localStorage: ' + sentQuinielas.length);
data.quinielas.forEach(function(quinielaBackend) {
let local = sentQuinielas.find(function(q) { return q.pythonId === quinielaBackend.id; });
if (local) {
local.estado = quinielaBackend.estado;
local.folio = quinielaBackend.folio;
local.pythonId = quinielaBackend.id;
console.log('✅ Actualizada: ' + local.name + ' → ' + local.estado + ' (' + (local.folio || 'sin folio') + ')');
} else {
const nueva = {
pythonId: quinielaBackend.id,
name: quinielaBackend.nombre,
vendedor: quinielaBackend.vendedor,
predictions: quinielaBackend.predictions,
estado: quinielaBackend.estado,
folio: quinielaBackend.folio,
jornada: quinielaBackend.jornada,
status: 'sent'
};
sentQuinielas.push(nueva);
console.log('➕ Recuperada del backend: ' + nueva.name + ' → ' + nueva.estado + ' (' + (nueva.folio || 'sin folio') + ')');
}
});
saveToStorage();
console.log('💾 Total en localStorage ahora: ' + sentQuinielas.length);
} catch (error) {
console.error('❌ Error sincronizando:', error);
}
}
async function renderMyQuinielas() {
const container = document.getElementById('myQuinielasList');
if (!container) return;
console.log('🔵 RENDERIZANDO');
try {
const responseResultados = await fetch(`${API_BASE}/api/resultados-oficiales`);
if (!responseResultados.ok) throw new Error('Error al cargar resultados');
const dataResultados = await responseResultados.json();
officialResults = dataResultados.resultados || {};
console.log('✅ Resultados cargados:', officialResults);
} catch (error) {
console.error('❌ Error cargando resultados:', error);
officialResults = {};
}
await actualizarEstadosDesdeBackend();
console.log('Total sentQuinielas en memoria:', sentQuinielas.length);
const jornadaNombre = (jornadaActual && jornadaActual.nombre) || 'Jornada actual';
console.log('Jornada actual:', jornadaNombre);
const quinielasDeJornada = sentQuinielas.filter(function(q) { return q.jornada === jornadaNombre; });
console.log('Quinielas filtradas para esta jornada:', quinielasDeJornada.length);
if (!quinielasDeJornada.length) {
container.innerHTML = `
<div class="empty-state">
<span class="empty-icon">📋</span>
<p>Aún no has enviado quinielas para la ${jornadaNombre}</p>
<button class="btn-primary" onclick="navigateTo('quiniela')">Crear mi primera quiniela</button>
</div>
`;
return;
}
const hayResultados = Object.keys(officialResults).length > 0;
const quinielasConDatos = quinielasDeJornada.map(function(q) {
const jugando = (q.estado === 'jugando');
const puntos = hayResultados ? calcularPuntosQuiniela(q.predictions) : 0;
return { quiniela: q, jugando: jugando, puntos: puntos };
});
quinielasConDatos.sort(function(a, b) {
if (a.jugando && !b.jugando) return -1;
if (!a.jugando && b.jugando) return 1;
return b.puntos - a.puntos;
});
const quinielasHtml = quinielasConDatos.map(function(item) {
const q = item.quiniela;
const jugando = item.jugando;
const puntos = item.puntos;
const statusIcon = jugando ? '✓' : '✗';
const statusText = jugando ? 'Jugando' : 'No jugando';
const cardClass = jugando ? 'jugando' : 'no-jugando';
const folioDisplay = (jugando && q.folio) ? q.folio : null;
const folioHtml = folioDisplay ? '<div class="jugada-folio">Folio: ' + folioDisplay + '</div>' : '';
const miniQuinielaHtml = partidos.map(function(partido, index) {
const predArr = q.predictions[partido.id];
const pick = Array.isArray(predArr) ? predArr[0] || '-' : String(predArr) || '-';
const resultadoReal = officialResults[String(index)];
const pickSan = pick ? pick.trim().toUpperCase() : '-';
let pickClass = 'quiniela-pick';
if (resultadoReal) {
pickClass += (pickSan === resultadoReal) ? ' correct' : ' incorrect';
}
return `
<div class="quiniela-row">
<div class="quiniela-team">
<img src="${partido.localLogo}" alt="${partido.local}">
<span>${partido.local}</span>
</div>
<div class="${pickClass}">${pick}</div>
<div class="quiniela-team" style="justify-content:flex-end;">
<span style="text-align:right;">${partido.visitante}</span>
<img src="${partido.visitanteLogo}" alt="${partido.visitante}">
</div>
</div>
`;
}).join('');
return `
<div class="jugada-card ${cardClass}">
<div class="jugada-header ${cardClass}">
<div class="jugada-info">
<div class="jugada-name">${q.name}</div>
<div class="jugada-vendedor">Vendedor: ${q.vendedor || 'El Wero'} • ${q.jornada}</div>
${folioHtml}
</div>
<div class="jugada-status">
<span class="status-badge ${cardClass}">${statusText} ${statusIcon}</span>
</div>
</div>
${miniQuinielaHtml}
<button class="btn-puntos">Puntos: ${puntos}</button>
</div>
`;
}).join('');
container.innerHTML = quinielasHtml;
console.log('✅ Renderizado completo');
}
/* = Anti-duplicados en Jugadas (sentQuinielas) = */
function limpiarDuplicados() {
if (!Array.isArray(sentQuinielas) || sentQuinielas.length === 0) {
return;
}
const vistas = new Set();
const limpias = [];
sentQuinielas.forEach(function(q) {
const key = generarKeyQuiniela(q);
if (!vistas.has(key)) {
vistas.add(key);
limpias.push(q);
} else {
console.warn("Duplicado eliminado en Jugadas:", q.name, q.folio);
}
});
if (limpias.length !== sentQuinielas.length) {
console.log("Limpieza:", sentQuinielas.length - limpias.length, "duplicados eliminados");
}
sentQuinielas = limpias;
saveToStorage && saveToStorage();
}
/* = Sistema para envio de quinielas por whats App = */
function generarKeyQuiniela(q) {
return (q.pythonId ? 'py-' + q.pythonId : '') + '|' +
(q.folio ? 'fo-' + q.folio : '') + '|' +
(q.name || '') + '|' + (q.vendedor || '');
}
async function procesarEnvioWhatsApp(quinielas, totalPrice) {
if (!quinielas || quinielas.length === 0) {
showErrorModal("No hay quinielas para enviar");
return;
}
for (const q of quinielas) {
const validacion = validarQuiniela(q);
if (!validacion.valida) {
showErrorModal("Error en \"" + q.name + "\": " + validacion.error);
return;
}
}
console.log("Iniciando envio de " + quinielas.length + " quinielas...");
const loadingModal = mostrarModalCargando(quinielas.length);
try {
const resultado = await enviarQuinielasAPython(quinielas);
if (loadingModal && document.body.contains(loadingModal)) {
loadingModal.remove();
}
if (resultado.exitosas.length === 0) {
console.error("Ninguna quiniela se guardo");
mostrarErrorEnvio(resultado.fallidas);
return;
}
resultado.exitosas.forEach(function(q) {
q.jornada = q.jornada || (jornadaActual && jornadaActual.nombre) || 'Jornada actual';
q.status = "sent";
if (!q.id) {
q.id = (q.pythonId || "") + "-" + (q.folio || "") + "-" + Date.now();
}
const key = generarKeyQuiniela(q);
const yaExiste = sentQuinielas.find(function(existing) {
return generarKeyQuiniela(existing) === key;
});
if (!yaExiste) {
console.log("Agregando nueva quiniela a Jugadas:", q.name, q.folio);
sentQuinielas.push(q);
} else {
console.log("Actualizando quiniela existente en Jugadas:", q.name, q.folio);
Object.assign(yaExiste, q);
}
});
limpiarDuplicados();
savedQuinielas = [];
saveToStorage();
console.log("Total en sentQuinielas despues de enviar:", sentQuinielas.length);
console.log("Actualizando UI...");
updateSavedBadge();
if (typeof renderMyQuinielas === 'function') {
renderMyQuinielas();
} else {
console.warn('⚠️ renderMyQuinielas no disponible');
}
updateHeroStats();
mostrarConfirmacionEnvio(
resultado.exitosas.length,
totalPrice,
resultado.fallidas.length,
resultado.exitosas
);
} catch (error) {
if (loadingModal && document.body.contains(loadingModal)) {
loadingModal.remove();
}
console.error("Error critico:", error);
showErrorModal("Error de conexion con el servidor");
}
}
/* = Envio de quinielas a Python = */
async function enviarQuinielasAPython(quinielas) {
const exitosas = [];
const fallidas = [];
console.log("Enviando " + quinielas.length + " quinielas a Python...");
for (let i = 0; i < quinielas.length; i++) {
const q = quinielas[i];
try {
const predictions = {};
partidos.forEach(function(partido) {
const pick = q.predictions[partido.id];
if (pick && pick.length > 0) {
predictions[partido.id] = pick;
}
});
const payload = {
nombre: q.name.trim(),
vendedor: q.vendedor || currentVendedor || "Desconocido",
predictions: predictions,
userId: userId
};
console.log("Enviando " + (i + 1) + "/" + quinielas.length + ":", payload.nombre);
const controller = new AbortController();
const timeoutId = setTimeout(function() { controller.abort(); }, 10000);
const response = await fetch(API_BASE + "/api/quinielas", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
signal: controller.signal
});
clearTimeout(timeoutId);
const resultado = await response.json();
if (response.ok && resultado.id) {
q.pythonId = resultado.id;
q.folio = resultado.folio;
q.estado = resultado.estado;
exitosas.push(q);
console.log(
(i + 1) + "/" + quinielas.length +
" - " + q.name + " OK (Folio: " + resultado.folio + ")"
);
} else {
const razon =
resultado.error ||
resultado.detail ||
JSON.stringify(resultado) ||
"Error desconocido";
fallidas.push({
quiniela: q.name,
razon: razon,
detalle: resultado.error || resultado.detail
});
console.error(
(i + 1) + "/" + quinielas.length +
" - " + q.name + ": " + razon
);
}
} catch (error) {
let razon = "Error de conexion";
if (error.name === "AbortError") razon = "Timeout";
else if (error.message) razon = error.message;
fallidas.push({
quiniela: q.name || "Sin nombre",
razon: razon,
detalle: error.toString()
});
console.error(
(i + 1) + "/" + quinielas.length +
" - Error:", error
);
}
await new Promise(function(resolve) { setTimeout(resolve, 100); });
}
console.log(
"Resultado final: " +
exitosas.length + " exitosas, " +
fallidas.length + " fallidas"
);
return { exitosas: exitosas, fallidas: fallidas };
}
/* =Estructura para el mensaje de whats app = */
function generarMensajeWhatsApp(quinielas, totalPrice) {
let mensaje = "";
quinielas.forEach(function(q, index) {
mensaje += "*" + q.name + "*\n";
partidos.forEach(function(partido, idx) {
const pred = q.predictions[partido.id];
if (pred && pred.length > 0) {
mensaje += "P" + (idx + 1) + " " + pred[0] + "\n";
}
});
if (index < quinielas.length - 1) {
mensaje += "\n";
}
});
mensaje += "\n━━━━━━━━━━━━━━\n";
mensaje += "Total: " + quinielas.length + " " + (quinielas.length === 1 ? "quiniela" : "quinielas");
mensaje += "\nA pagar: $" + totalPrice;
mensaje += "\n\nEn unos momentos te envío el comprobante";
return mensaje;
}
function mostrarErrorEnvio(fallidas) {
const modalId = 'modalErrorEnvio';
const existente = document.getElementById(modalId);
if (existente) existente.remove();
const modal = document.createElement("div");
modal.id = modalId;
modal.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;";
modal.innerHTML =
"<div style=\"background: #fff; border-radius: 20px; padding: 30px; max-width: 400px; width: 100%; text-align: center;\">" +
"<div style=\"font-size: 80px; margin-bottom: 15px;\">❌</div>" +
"<h2 style=\"color: #ef4444; margin: 0 0 15px 0; font-size: 22px;\">Error al enviar</h2>" +
"<p style=\"color: #666; font-size: 14px; margin-bottom: 20px;\">" +
"No se pudieron guardar " + fallidas.length + " " + (fallidas.length === 1 ? "quiniela" : "quinielas") +
"</p>" +
"<div style=\"max-height: 200px; overflow-y: auto; text-align: left; margin-bottom: 20px;\">" +
fallidas.map(function(f) {
return "<div style=\"padding: 8px; margin: 5px 0; background: #fee2e2; border-left: 3px solid #ef4444; border-radius: 4px;\">" +
"<div style=\"font-weight: 600; color: #1f2937; font-size: 14px;\">" + f.quiniela + "</div>" +
"<div style=\"font-size: 12px; color: #666; margin-top: 3px;\">" + f.razon + "</div>" +
"</div>";
}).join("") +
"</div>" +
"<button id=\"btnCerrarErrorEnvio\" style=\"width: 100%; padding: 12px; background: #ef4444; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer;\">Cerrar</button>" +
"</div>";
document.body.appendChild(modal);
document.getElementById('btnCerrarErrorEnvio').addEventListener('click', function() {
modal.remove();
});
}
function mostrarConfirmacionEnvio(exitosas, totalPrice, fallidas, quinielasData) {
const exitosasEl = document.getElementById('exitosasCount');
const totalPriceEl = document.getElementById('totalPriceAmount');
const mensajeEl = document.getElementById('mensajeEnvio');
const btnWhatsApp = document.getElementById('btnIrWhatsApp');
const modalEl = document.getElementById('modalEnvioExitoso');
if (!exitosasEl || !totalPriceEl || !mensajeEl || !btnWhatsApp || !modalEl) {
console.error('❌ Faltan elementos en el HTML para mostrarConfirmacionEnvio');
return;
}
exitosasEl.textContent = exitosas;
totalPriceEl.textContent = '$' + totalPrice;
if (fallidas > 0) {
mensajeEl.textContent = exitosas + " " + (exitosas === 1 ? "quiniela enviada" : "quinielas enviadas") + ". " + fallidas + " " + (fallidas === 1 ? "falló" : "fallaron") + ".";
} else {
mensajeEl.innerHTML = '¡Todas tus quinielas están listas!<br>Ve a WhatsApp para compartirlas.';
}
const mensaje = generarMensajeWhatsApp(quinielasData, totalPrice);
const numeroWhatsApp = "528281011650";
const whatsappUrl = "https://wa.me/" + numeroWhatsApp + "?text=" + encodeURIComponent(mensaje);
btnWhatsApp.onclick = function() {
window.open(whatsappUrl, '_blank');
cerrarModalEnvio();
};
modalEl.classList.add('show');
}
function cerrarModalEnvio() {
const modalEl = document.getElementById('modalEnvioExitoso');
if (modalEl) modalEl.classList.remove('show');
}
/* = Esto de abajo trabaja el reglamento de nuestra quiniela = */
function showReglamento() {
openModal(`
<h3>📋 Reglamento</h3>
<p style="font-size: 0.875rem; color: var(--gris-300); line-height: 1.6;">
<strong>1-Primer Lugar:</strong> Será el participante que obtenga el mayor número de aciertos.<br>
En caso de empate , el monto total del premio se repartirá en partes iguales.<br>
<br>
<strong>2-Segundo Lugar:</strong> Un acierto menos <br>que el primer lugar.<br>
Solamente será repartido y entregado el monto asignado al segundo lugar, siempre y cuando se cumpla el requisito. <br>
<br>
<strong>3-El monto publicado</strong> es lo que se le entregará al ganador(es).<br>
<br>
<strong>4-Solo se podra apostar por:<br></strong> Equipo local, empate o equipo visitante.<br>
El resultado válido para cada partido será únicamente el obtenido durante el tiempo reglamentario, es decir,
los 90 minutos más el tiempo agregado.<br>
<br>
<strong>5-Es responsabilidad del participante</strong> verificar que su quiniela esté<br>correctamente registrada.<br>
En caso de existir algún error y no ser reportado antes de la publicación de la lista final, no se podrán realizar correcciones posteriormente.<br>
<br>
<strong>6-Quiniela no capturada:</strong><br>
Si tu quiniela no fue registrada por algún error, ya sea por parte del vendedor o por un fallo nuestro, simplemente se te reembolsará el costo total de la quiniela.<br>
<br>
<strong>7-Participacion de la quiniela:</strong><br>
Tu quiniela participará conforme a cómo fue capturada y publicada en la lista final.<br>
Si no estás de acuerdo con los resultados registrados, podrás solicitar el reembolso antes de que inicie el 2 partido.<br>
<br>
<strong>8-Publicacion de la lista final:</strong><br>
Cada semana, antes de iniciar el primer partido, se publicará la lista final de participantes, la cual no podrá ser modificada una vez publicada. <br>
<br>
<strong>9-Partidos suspendidos o pospuestos:</strong><br>
Si un partido es suspendido durante su transcurso, se tomará en cuenta siempre y cuando se reanude y finalice dentro <br>de la misma jornada.<br>
De lo contrario, se considerará como resultado oficial el marcador al momento <br>de la suspensión.<br>
Por otra parte, si un partido es pospuesto antes de iniciar y no se juega dentro de la misma jornada, dicho partido no será tomado en cuenta.<br>
</p>
`);
}
/* = Esto de abajo trabaja en la ayuda al cliente para realizar la quiniela = */
function showHelpModal() {
openModal(`
<h3 style="text-align:center;">¿Cómo jugar tu quiniela? ⚽</h3>
<p style="text-align:center; opacity:.85; margin-top:.5rem;">
Rápido, fácil y desde tu celular 📲
</p>
<div style="margin-top:1.5rem;">
<div style="margin-bottom: 1rem;">
<span style="font-size: 1.5rem;">1</span>
<p>Selecciona el resultado<br>
<small>Local 🤝 Empate 🤝 Visita</small></p>
</div>
<div style="margin-bottom: 1rem;">
<span style="font-size: 1.5rem;">2</span>
<p>Completa <strong>todos</strong> los partidos<br>
<small>No dejes ninguno vacío 👀</small></p>
</div>
<div style="margin-bottom: 1rem;">
<span style="font-size: 1.5rem;">3</span>
<p>Escribe tu nombre y <br> guarda tu quiniela 💾 <br>
<small>Así queda registrada correctamente</small></p>
</div>
<div style="margin-bottom: 1rem;">
<span style="font-size: 1.5rem;">4</span>
<p>Envía tu quiniela por <strong>WhatsApp</strong> 📲<br>
<small>Un solo toque y listo</small></p>
</div>
<div style="margin-bottom: 1rem;">
<span style="font-size: 1.5rem;">5</span>
<p><strong>¡Muy importante!</strong><br>
<small>Envíala antes del cierre ⏰</small></p>
</div>
</div>
<p style="text-align:center; margin-top:1.2rem; font-weight:600;">
🍀 ¡Mucha suerte! 🍀
</p>
`);
}
/* = Se usa para: reglamento, ayuda, errores, quinielas guardadas = */
function openModal(content) {
const existingModal = document.getElementById('customModal');
if (existingModal) existingModal.remove();
const modal = document.createElement('div');
modal.id = 'customModal';
modal.style.cssText = `
position: fixed;
top: 0;
left: 0;
width: 100%;
height: 100%;
background: rgba(0, 0, 0, 0.9);
display: flex;
display: -webkit-flex;
align-items: center;
-webkit-align-items: center;
justify-content: center;
-webkit-justify-content: center;
z-index: 9999;
padding: 20px;
overflow-y: auto;
-webkit-overflow-scrolling: touch;
`;
const modalContent = document.createElement('div');
modalContent.style.cssText = `
background: #0a0a0a;
border: 2px solid var(--verde);
border-radius: 12px;
padding: 24px;
max-width: 600px;
width: 100%;
max-height: 90vh;
overflow-y: auto;
-webkit-overflow-scrolling: touch;
position: relative;
color: var(--blanco);
`;
modalContent.innerHTML = `
${content}
<button onclick="closeModal()" style="
margin-top: 20px;
width: 100%;
padding: 12px;
background: var(--verde);
color: white;
border: none;
border-radius: 8px;
font-size: 0.875rem;
font-weight: 700;
cursor: pointer;
-webkit-tap-highlight-color: transparent;
touch-action: manipulation;
">Cerrar ✖️</button>
`;
modal.appendChild(modalContent);
document.body.appendChild(modal);
modal.addEventListener('click', (e) => {
if (e.target === modal) closeModal();
});
}
function closeModal() {
const modal = document.getElementById('customModal');
if (modal) modal.remove();
}
/* = Esto de abajo trabaja para mi seccion de ayuda = */
function debounce(func, wait) {
let timeout;
return function executedFunction(...args) {
const later = () => {
clearTimeout(timeout);
func(...args);
};
clearTimeout(timeout);
timeout = setTimeout(later, wait);
};
}
async function copyToClipboard(text) {
try {
if (navigator.clipboard && navigator.clipboard.writeText) {
await navigator.clipboard.writeText(text);
return true;
}
const textArea = document.createElement("textarea");
textArea.value = text;
textArea.style.position = "fixed";
textArea.style.left = "-9999px";
document.body.appendChild(textArea);
textArea.select();
document.execCommand("copy");
document.body.removeChild(textArea);
return true;
} catch (err) {
console.error("Failed to copy:", err);
return false;
}
}
const HelpCards = {
init() {
const cards = document.querySelectorAll(".help-card");
cards.forEach((card) => {
card.addEventListener("click", () => this.toggle(card));
card.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") {
e.preventDefault();
this.toggle(card);
}
});
card.setAttribute("tabindex", "0");
card.setAttribute("role", "button");
card.setAttribute("aria-expanded", "false");
});
},
toggle(card) {
const isOpen = card.classList.contains("active");
document.querySelectorAll(".help-card.active").forEach((openCard) => {
if (openCard !== card) {
openCard.classList.remove("active");
openCard.setAttribute("aria-expanded", "false");
}
});
card.classList.toggle("active");
card.setAttribute("aria-expanded", !isOpen);
if ("vibrate" in navigator) {
navigator.vibrate(10);
}
},
};
const DepositCards = {
accounts: {
bbva: {
cuenta: "0123456789",
clabe: "012345678901234567",
},
banorte: {
cuenta: "9876543210",
clabe: "072345678901234567",
},
oxxo: {
referencia: "1234567890123456",
},
},
init() {
const copyButtons = document.querySelectorAll(".help-deposit-card__copy");
copyButtons.forEach((button) => {
button.addEventListener("click", (e) => {
e.stopPropagation();
this.copyAccount(button);
});
});
},
async copyAccount(button) {
const accountType = button.dataset.account;
const account = this.accounts[accountType];
if (!account) return;
const textToCopy = account.clabe || account.referencia || account.cuenta;
const success = await copyToClipboard(textToCopy);
if (success) {
button.classList.add("copied");
const originalHTML = button.innerHTML;
button.innerHTML = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
<polyline points="20 6 9 17 4 12"></polyline>
</svg>
<span>¡Listo!</span>
`;
showToast("Copiado al portapapeles", "success");
if ("vibrate" in navigator) {
navigator.vibrate([10, 50, 10]);
}
setTimeout(() => {
button.classList.remove("copied");
button.innerHTML = originalHTML;
}, 2000);
}
},
};
const FAQ = {
init() {
const items = document.querySelectorAll(".help-faq-item");
items.forEach((item) => {
const question = item.querySelector(".help-faq-question");
question.addEventListener("click", () => this.toggle(item));
question.setAttribute("aria-expanded", "false");
});
},
toggle(item) {
const isOpen = item.classList.contains("active");
const question = item.querySelector(".help-faq-question");
document.querySelectorAll(".help-faq-item.active").forEach((openItem) => {
if (openItem !== item) {
openItem.classList.remove("active");
openItem.querySelector(".help-faq-question").setAttribute("aria-expanded", "false");
}
});
item.classList.toggle("active");
question.setAttribute("aria-expanded", !isOpen);
if ("vibrate" in navigator) {
navigator.vibrate(10);
}
},
};
const ScrollAnimations = {
observer: null,
init() {
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
this.showAllElements();
return;
}
const options = {
root: null,
rootMargin: "0px 0px -50px 0px",
threshold: 0.1,
};
this.observer = new IntersectionObserver((entries) => {
entries.forEach((entry) => {
if (entry.isIntersecting) {
const delay = this.getStaggerDelay(entry.target);
setTimeout(() => {
entry.target.classList.add("visible");
}, delay);
this.observer.unobserve(entry.target);
}
});
}, options);
const elements = document.querySelectorAll(".help-card, .help-deposit-card, .help-step, .help-faq-item");
elements.forEach((el) => this.observer.observe(el));
},
getStaggerDelay(element) {
const siblings = element.parentElement.children;
const index = Array.from(siblings).indexOf(element);
return index * 100;
},
showAllElements() {
const elements = document.querySelectorAll(".help-card, .help-deposit-card, .help-step, .help-faq-item");
elements.forEach((el) => el.classList.add("visible"));
},
};
const TouchFeedback = {
init() {
const interactiveElements = document.querySelectorAll(
".help-card, .help-deposit-card, .help-faq-question, .help-whatsapp-button, .help-deposit-card__copy"
);
interactiveElements.forEach((el) => {
el.addEventListener(
"touchstart",
() => {
el.style.opacity = "0.9";
},
{ passive: true }
);
el.addEventListener(
"touchend",
() => {
el.style.opacity = "";
},
{ passive: true }
);
el.addEventListener(
"touchcancel",
() => {
el.style.opacity = "";
},
{ passive: true }
);
});
},
};
const SmoothScroll = {
init() {
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
anchor.addEventListener("click", (e) => {
e.preventDefault();
const targetId = anchor.getAttribute("href");
const target = document.querySelector(targetId);
if (target) {
target.scrollIntoView({
behavior: "smooth",
block: "start",
});
}
});
});
},
};
function initHelpPage() {
HelpCards.init();
DepositCards.init();
FAQ.init();
ScrollAnimations.init();
TouchFeedback.init();
SmoothScroll.init();
console.log("✅ Ayuda inicializada");
}
document.addEventListener("visibilitychange", () => {
if (document.visibilityState === "visible" && !ScrollAnimations.observer) {
ScrollAnimations.init();
}
});
/* = Inicialización - Cuando la página carga completamente = */
document.addEventListener('DOMContentLoaded', async function() {
console.log('🚀 Quinielas El Wero cargado');
try {
await cargarPartidos();
await cargarJornadaActual();
updateHeroStats();
cargarPorcentajes();
actualizarJornada();
renderMatchesHorarios();
renderQuinielaMatches();
updateQuinielaCount();
updatePrice();
updateSavedBadge();
initHelpPage();
setInterval(async function() {
await cargarPorcentajes();
}, 30000);
const simHeaders = document.querySelectorAll('#tabSimulador .results-table thead .col-match');
simHeaders.forEach(function(th) {
const index = parseInt(th.dataset.matchIndex, 10);
const partido = partidos[index - 1];
if (!partido) return;
th.innerHTML =
'<div class="match-header">' +
'<img src="' + partido.localLogo + '" alt="' + partido.local + '" class="match-logo">' +
'<span class="match-vs">vs</span>' +
'<img src="' + partido.visitanteLogo + '" alt="' + partido.visitante + '" class="match-logo">' +
'</div>';
});
loadDataFromAPI().then(function(success) {
if (success) {
console.log('✅ Datos de Lista Oficial cargados');
quiniela.initFirstPlacePage();
quiniela.initSecondPlacePage();
simulador.init();
} else {
console.warn('⚠️ Lista Oficial no disponible');
}
});
renderMatchesHeader();
const currentPage = window.location.hash.replace('#', '') || 'inicio';
if (currentPage === 'resultados') {
if (typeof renderMyQuinielas === 'function') {
renderMyQuinielas();
}
}
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
if (searchBtn) {
searchBtn.addEventListener('click', function() {
if (typeof quiniela !== 'undefined' && quiniela.searchParticipant) {
quiniela.searchParticipant();
}
});
}
if (searchInput) {
searchInput.addEventListener('input', debounce(function() {
if (typeof quiniela !== 'undefined' && quiniela.searchParticipant) {
quiniela.searchParticipant();
}
}, 300));
searchInput.addEventListener('keypress', function(e) {
if (e.key === 'Enter') {
if (typeof quiniela !== 'undefined' && quiniela.searchParticipant) {
quiniela.searchParticipant();
}
}
});
}
console.log('✅ Inicialización completa');
} catch (error) {
console.error('❌ Error en inicialización:', error);
}
});
/* = Activación del panel Admin - Modo secreto = */
const AdminPanel = {
activated: false,
init() {
const stored = sessionStorage.getItem('adminActivated');
const vendedor = localStorage.getItem('vendedor');  
if (stored === 'true' && vendedor) {
this.activated = true;
this.addAdminButton();
return;
}
const headerText = document.querySelector('.brand-name');
if (!headerText) {
console.warn('⚠️ Header .brand-name no encontrado');
return;
}
console.log('✅ Panel Admin disponible');
headerText.style.cursor = 'pointer';
headerText.style.userSelect = 'none';
let clickCount = 0;
let lastClickTime = 0;
headerText.addEventListener('click', (e) => {
e.preventDefault();
if (this.activated) {
navigateTo('admin');
return;
}
const now = Date.now();
if (now - lastClickTime > 2000) {
clickCount = 0;
}
lastClickTime = now;
clickCount++;
this.showClickFeedback(headerText);
console.log(`🔐 Clicks: ${clickCount}/3`);
if (clickCount >= 3) {
clickCount = 0;
this.mostrarPINAcceso();
}
});
},
showClickFeedback(element) {
element.style.transform = 'scale(1.1)';
element.style.color = 'var(--verde)';
setTimeout(() => {
element.style.transform = '';
element.style.color = '';
}, 200);
},
mostrarPINAcceso() {
const vendedor = localStorage.getItem('vendedor');
if (!vendedor) {
showToast('Vendedores⚠️', 'error');
return;
}
const modal = document.createElement('div');
modal.id = 'modalAdminPIN';
modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.95); display: flex; align-items: center; justify-content: center; z-index: 10000;`;
modal.innerHTML = `
<div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); padding: 40px 30px; border-radius: 16px; border: 2px solid var(--verde); max-width: 400px; width: 90%; text-align: center;">
<div style="font-size: 60px; margin-bottom: 20px;">⚙️</div>
<h2 style="color: var(--verde); margin-bottom: 10px;">Panel de Vendedor</h2>
<p style="color: #9ca3af; margin-bottom: 8px; font-size: 14px;">${vendedor}</p>
<p style="color: #666; margin-bottom: 25px; font-size: 13px;">Ingresa tu PIN de 4 dígitos</p>
<div id="pinDisplayAdmin" style="display: flex; gap: 12px; justify-content: center; margin-bottom: 25px;">
<div class="pin-dot-admin"></div>
<div class="pin-dot-admin"></div>
<div class="pin-dot-admin"></div>
<div class="pin-dot-admin"></div>
</div>
<div id="pinPadAdmin" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-width: 240px; margin: 0 auto 20px;">
${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(n => `<button class="pin-btn-admin" data-num="${n}" style="padding: 18px; background: ${n === '' ? 'transparent' : '#2a2a2a'}; color: white; border: ${n === '' ? 'none' : '1px solid #444'}; border-radius: 12px; font-size: 24px; font-weight: 700; cursor: ${n === '' ? 'default' : 'pointer'}; ${n === '' ? 'pointer-events: none;' : ''}">${n}</button>`).join('')}
</div>
<button id="btnCancelarAdmin" style="width: 100%; padding: 12px; background: transparent; color: #9ca3af; border: 1px solid #444; border-radius: 8px; cursor: pointer;">Cancelar</button>
<p id="errorAdmin" style="color: #ef4444; font-size: 13px; margin-top: 15px; min-height: 20px;"></p>
</div>
<style>
.pin-dot-admin { width: 16px; height: 16px; border-radius: 50%; background: #333; border: 2px solid #555; transition: all 0.3s; }
.pin-dot-admin.filled { background: var(--verde); border-color: var(--verde); box-shadow: 0 0 12px var(--verde); }
.pin-btn-admin:not([data-num=""]):hover { background: var(--verde) !important; }
</style>
`;
document.body.appendChild(modal);
let pinIngresado = '';
document.querySelectorAll('.pin-btn-admin').forEach(btn => {
btn.addEventListener('click', () => {
const num = btn.dataset.num;
if (num === '⌫') {
pinIngresado = pinIngresado.slice(0, -1);
this.actualizarPinDisplay(pinIngresado);
} else if (num !== '' && pinIngresado.length < 4) {
pinIngresado += num;
this.actualizarPinDisplay(pinIngresado);
if (pinIngresado.length === 4) {
this.verificarPINAdmin(pinIngresado, vendedor);
}
}
});
});
document.getElementById('btnCancelarAdmin').addEventListener('click', () => modal.remove());
},
actualizarPinDisplay(pin) {
const dots = document.querySelectorAll('.pin-dot-admin');
dots.forEach((dot, index) => {
if (index < pin.length) dot.classList.add('filled');
else dot.classList.remove('filled');
});
},
async verificarPINAdmin(pin, vendedor) {
const errorEl = document.getElementById('errorAdmin');
errorEl.textContent = '';
try {
const response = await fetch(`${API_BASE}/api/verificar-pin`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ vendedor: vendedor, pin: pin })
});
if (response.ok) {
sessionStorage.setItem('adminActivated', 'true');
this.activated = true;
document.getElementById('modalAdminPIN').remove();
this.addAdminButton();
setTimeout(() => document.querySelector('.nav-item[data-page="admin"]').click(), 500);
} else {
errorEl.textContent = '❌ PIN incorrecto';
const dots = document.querySelectorAll('.pin-dot-admin');
dots.forEach(dot => { dot.style.background = '#ef4444'; dot.style.borderColor = '#ef4444'; });
setTimeout(() => {
dots.forEach(dot => { dot.classList.remove('filled'); dot.style.background = ''; dot.style.borderColor = ''; });
this.actualizarPinDisplay('');
}, 500);
if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
}
} catch (error) {
errorEl.textContent = '❌ Error de conexión';
}
},
addAdminButton() {
const navItems = document.getElementById('navItems');
if (!navItems) return;
const existingBtn = document.querySelector('.nav-item[data-page="admin"]');
if (existingBtn) return;
const btn = document.createElement('button');
btn.className = 'nav-item';
btn.setAttribute('data-page', 'admin');
btn.innerHTML = '<span class="nav-icon">⚙️</span><span class="nav-label">Admin</span>';
btn.addEventListener('click', () => {
const adminPage = document.getElementById('pageAdmin');
const isAdminActive = adminPage && adminPage.classList.contains('active');
if (isAdminActive) {
navigateTo('inicio');
} else {
document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
btn.classList.add('active');
navigateTo('admin');
} 
const nav = document.getElementById('floatingNav');
if (nav) nav.classList.remove('open');
});
navItems.appendChild(btn);
console.log('✅ Botón admin agregado');
},
deactivate() {
this.activated = false;
sessionStorage.removeItem('adminActivated');
const btn = document.querySelector('.nav-item[data-page="admin"]');
if (btn) btn.remove();
navigateTo('inicio');
showToast('Sesión cerrada 🔒', 'success');
}
};
document.addEventListener('DOMContentLoaded', () => {
AdminPanel.init();
});
document.addEventListener('visibilitychange', () => {
if (document.hidden && AdminPanel.activated) {
console.log('👋 Desactivando modo admin...');
AdminPanel.deactivate();
}
});
window.addEventListener('beforeunload', () => {
if (AdminPanel.activated) {
sessionStorage.removeItem('adminActivated');
}
});
/* = Panel de Administrador =*/
async function renderAdminContent() {
console.log('📊 Renderizando panel admin...');
await cargarDatosAdmin();
animateAdminNumbers();
initAdminFilters();
}
async function cargarDatosAdmin() {
try {
const vendedor = localStorage.getItem('vendedor');
const response = await fetch(`${API_BASE}/api/quinielas?vendedor=${vendedor}&jornada=${jornadaActual.nombre}`);
if (!response.ok) {
console.error('❌ Error cargando quinielas admin');
return;
}
const data = await response.json();
if (data.success && data.quinielas) {
console.log(`✅ ${data.count} quinielas cargadas para ${vendedor}`);
renderAdminQuinielas(data.quinielas);
renderAdminAcceptedList(data.quinielas);
actualizarEstadisticasAdmin(data.quinielas);
} else {
renderAdminQuinielas([]);
}
} catch (error) {
console.error('❌ Error en cargarDatosAdmin:', error);
}
}
function actualizarEstadisticasAdmin(quinielas) {
const totalQuinielas = document.querySelector('#adminTotalQuinielas [data-count]');
const pendientes = document.querySelector('#adminPendientes [data-count]');
const jugando = document.querySelector('#adminJugando [data-count]');
if (totalQuinielas) totalQuinielas.setAttribute('data-count', quinielas.length);
const pendientesCount = quinielas.filter(q => q.estado === 'pendiente').length;
const jugandoCount = quinielas.filter(q => q.estado === 'jugando').length;
if (pendientes) pendientes.setAttribute('data-count', pendientesCount);
if (jugando) jugando.setAttribute('data-count', jugandoCount);
}
function animateAdminNumbers() {
const counters = document.querySelectorAll('#pageAdmin [data-count]');
counters.forEach(counter => {
const target = parseInt(counter.getAttribute('data-count')) || 0;
let current = 0;
const increment = Math.ceil(target / 50);
const timer = setInterval(() => {
current += increment;
if (current >= target) {
counter.textContent = target;
clearInterval(timer);
} else {
counter.textContent = current;
}
}, 20);
});
}
function renderAdminQuinielas(quinielas) {
const container = document.getElementById('adminQuinielasContainer');
if (!container) return;
if (!quinielas || quinielas.length === 0) {
container.innerHTML = `
<div style="text-align: center; padding: 40px; color: var(--gray-500);">
<div style="font-size: 60px; margin-bottom: 16px;">📋</div>
<p>No hay quinielas para mostrar</p>
</div>
`;
return;
}
container.innerHTML = quinielas.map((q, index) => {
const statusBadge = q.estado === 'jugando'
? '<span style="background: var(--verde); color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem;">🎮 Jugando</span>'
: q.estado === 'espera'
? '<span style="background: var(--amarillo); color: black; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem;">⏳ En espera</span>'
: '<span style="background: #666; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem;">📝 Pendiente</span>';
return `
<div style="background: var(--fondo-tarjeta); padding: 16px; border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--borde);">
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
<div>
<h4 style="margin: 0 0 4px 0; color: var(--verde); font-size: 1rem;">${q.nombre}</h4>
<p style="margin: 0; font-size: 0.75rem; color: var(--gray-500);">
Folio: ${q.folio} | ID: ${q.id}
</p>
</div>
${statusBadge}
</div>
<div style="display: flex; gap: 4px; flex-wrap: wrap;">
${partidos.slice(0, 3).map(partido => {
const pred = q.predictions[partido.id];
const pick = Array.isArray(pred) ? pred[0] : pred || '-';
return `<span style="background: var(--verde); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">${pick}</span>`;
}).join('')}
<span style="color: var(--gray-500); padding: 4px 8px; font-size: 0.7rem;">...</span>
</div>
<button onclick="verDetalleAdmin(${q.id})" style="margin-top: 12px; width: 100%; padding: 8px; background: transparent; color: var(--verde); border: 1px solid var(--verde); border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
Ver completa
</button>
</div>
`;
}).join('');
}
async function verDetalleAdmin(quinielaId) {
try {
const response = await fetch(`${API_BASE}/api/quinielas/${quinielaId}`);
if (!response.ok) {
showToast('Error cargando detalle ❌ ', 'error');
return;
}
const data = await response.json();
const q = data.quiniela;
const modal = document.getElementById('adminDetailModal');
const title = document.getElementById('adminModalTitle');
const status = document.getElementById('adminModalStatus');
const body = document.getElementById('adminModalBody');
if (!modal || !title || !status || !body) {
console.error('❌ Elementos del modal no encontrados');
return;
}
title.textContent = q.nombre;
status.textContent = q.estado === 'jugando' ? 'Jugando' : q.estado === 'espera' ? 'En espera' : 'Pendiente';
status.style.background = q.estado === 'jugando' ? 'var(--verde)' : q.estado === 'espera' ? 'var(--amarillo)' : '#666';
body.innerHTML = `
<div style="margin-bottom: 20px; padding: 16px; background: var(--fondo); border-radius: 8px;">
<p style="margin: 8px 0;"><strong>Folio:</strong> ${q.folio}</p>
<p style="margin: 8px 0;"><strong>Vendedor:</strong> ${q.vendedor}</p>
<p style="margin: 8px 0;"><strong>ID:</strong> ${q.id}</p>
<p style="margin: 8px 0;"><strong>Jornada:</strong> ${q.jornada}</p>
<p style="margin: 8px 0;"><strong>Estado:</strong> ${q.estado}</p>
</div>
<h4 style="margin: 16px 0;">Predicciones completas:</h4>
<div style="display: flex; flex-direction: column; gap: 8px;">
${partidos.map(partido => {
const pred = q.predictions[partido.id];
const pick = Array.isArray(pred) ? pred.join('/') : (pred || '-');
return `
<div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--fondo); border-radius: 8px;">
<div style="display: flex; align-items: center; gap: 8px; flex: 1;">
<img src="${partido.localLogo}" style="width: 20px; height: 20px;">
<span style="font-size: 0.8rem;">${partido.local}</span>
</div>
<div style="background: var(--verde); color: white; padding: 6px 12px; border-radius: 6px; font-weight: 700; min-width: 50px; text-align: center;">
${pick}
</div>
<div style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end;">
<span style="font-size: 0.8rem;">${partido.visitante}</span>
<img src="${partido.visitanteLogo}" style="width: 20px; height: 20px;">
</div>
</div>
`;
}).join('')}
</div>
`;
modal.style.display = 'flex';
modal.setAttribute('aria-hidden', 'false');
} catch (error) {
console.error('❌ Error en verDetalleAdmin:', error);
showToast('Error cargando detalle ❌  ', 'error');
}
}
function renderAdminAcceptedList(quinielas) {
const container = document.getElementById('adminAcceptedList');
if (!container) return;
const jugando = quinielas.filter(q => q.estado === 'jugando');
if (jugando.length === 0) {
container.innerHTML = `
<div style="text-align: center; padding: 40px; color: var(--gray-500);">
<p>No hay quinielas jugando aún</p>
</div>
`;
return;
}
container.innerHTML = jugando.map(q => `
<div style="background: var(--fondo-tarjeta); padding: 16px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
<div>
<h4 style="margin: 0 0 4px 0; color: var(--verde);">${q.nombre}</h4>
<p style="margin: 0; font-size: 0.75rem; color: var(--gray-500);">${q.folio} • ${q.vendedor}</p>
</div>
<span style="background: var(--verde); color: white; padding: 6px 14px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
🎮 Jugando
</span>
</div>
`).join('');
}
function initAdminFilters() {
const filterBtns = document.querySelectorAll('#pageAdmin .filter-btn');
filterBtns.forEach(btn => {
btn.addEventListener('click', function() {
filterBtns.forEach(b => b.classList.remove('active'));
this.classList.add('active');
const filtro = this.getAttribute('data-filter');
if (filtro === 'pending') {
mostrarAdminTab('pendientes');
} else if (filtro === 'espera') {
mostrarAdminTab('espera');
} else if (filtro === 'jugando') {
mostrarAdminTab('jugando');
}
});
});
const closeModalBtns = document.querySelectorAll('[data-close-modal]');
closeModalBtns.forEach(btn => {
btn.addEventListener('click', () => {
const modal = document.getElementById('adminDetailModal');
if (!modal) return;
modal.style.display = 'none';
modal.setAttribute('aria-hidden', 'true');
});
});
}
/* = Esto de abajo trabaja en actualizar informacion de la quiniela= */
function actualizarJornadaActual() {
if (!jornadaActual) {
console.warn('⚠️ jornadaActual no cargado todavía');
return;
}
const jornadaNum = document.querySelector('.week-card__number');
const jornadaRange = document.querySelector('.week-card__range');
const jornadaStatus = document.querySelector('.week-card__status');
const progressBar = document.querySelector('.progress-bar__fill');
const progressLabel = document.querySelector('.progress-labels span:nth-child(2)');
if (jornadaNum && jornadaActual.numero) jornadaNum.textContent = jornadaActual.numero;
if (jornadaRange) jornadaRange.textContent = jornadaActual.nombre;
const ahora = new Date();
const inicio = new Date(jornadaActual.inicio);
const fin = new Date(jornadaActual.fin);
const totalMs = fin - inicio;
const transcurridoMs = ahora - inicio;
const faltaMs = fin - ahora;
let porcentaje = 0;
if (totalMs > 0) {
porcentaje = Math.max(0, Math.min(100, (transcurridoMs / totalMs) * 100));
}
if (progressBar) {
progressBar.style.setProperty('--progress', porcentaje.toFixed(0) + '%');
}
if (progressLabel) {
progressLabel.textContent = porcentaje.toFixed(0) + '% completado';
}
if (faltaMs > 0) {
const horas = Math.floor(faltaMs / (1000 * 60 * 60));
const minutos = Math.floor((faltaMs % (1000 * 60 * 60)) / (1000 * 60));
if (jornadaStatus) {
jornadaStatus.textContent = 'Cierra en ' + horas + 'h ' + minutos + 'm';
}
} else {
if (jornadaStatus) jornadaStatus.textContent = 'Jornada cerrada';
}
}
/* = Sistema de confirmación/rechazo de quinielas = */
let quinielaIdTemporal = null;
let nombreQuinielaTemporal = '';
let vendedorQuinielaTemporal = '';
document.addEventListener('click', function(e) {
const btnConfirmar = e.target.closest('.btn-confirmar');
const btnRechazar = e.target.closest('.btn-rechazar');
if (btnConfirmar) {
const row = btnConfirmar.closest('.admin-row');
if (!row) return;
const id = Number(row.dataset.id);
const nombre = row.dataset.nombre || '';
const vendedor = row.dataset.vendedor || currentVendedor;
confirmarQuiniela(id, nombre, vendedor);
return;
}
if (btnRechazar) {
const row = btnRechazar.closest('.admin-row');
if (!row) return;
const id = Number(row.dataset.id);
const nombre = row.dataset.nombre || '';
rechazarQuiniela(id, nombre);
return;
}
});
function mostrarModalConfirmar(id, nombre, vendedor) {
quinielaIdTemporal = id;
nombreQuinielaTemporal = nombre;
vendedorQuinielaTemporal = vendedor;
const msgEl = document.getElementById('confirmarMessage');
const modalEl = document.getElementById('modalConfirmar');
if (msgEl) msgEl.textContent = '"' + nombre + '" pasará a estado "jugando"';
if (modalEl) modalEl.classList.add('show');
}
function cerrarModalConfirmar() {
const modalEl = document.getElementById('modalConfirmar');
if (modalEl) modalEl.classList.remove('show');
quinielaIdTemporal = null;
nombreQuinielaTemporal = '';
vendedorQuinielaTemporal = '';
}
function mostrarModalRechazar(id, nombre) {
quinielaIdTemporal = id;
nombreQuinielaTemporal = nombre;
const msgEl = document.getElementById('rechazarMessage');
const modalEl = document.getElementById('modalRechazar');
if (msgEl) msgEl.textContent = '"' + nombre + '" será eliminada permanentemente';
if (modalEl) modalEl.classList.add('show');
}
function cerrarModalRechazar() {
const modalEl = document.getElementById('modalRechazar');
if (modalEl) modalEl.classList.remove('show');
quinielaIdTemporal = null;
nombreQuinielaTemporal = '';
}
function confirmarQuiniela(id, nombre, vendedor) {
if (!id) {
showToast('ID de quiniela inválido ❌', 'error');
return;
}
mostrarModalConfirmar(id, nombre, vendedor);
}
function rechazarQuiniela(id, nombre) {
if (!id) {
showToast('ID de quiniela inválido ❌', 'error');
return;
}
mostrarModalRechazar(id, nombre);
}
async function ejecutarConfirmar() {
if (!quinielaIdTemporal) return;
const id = quinielaIdTemporal;
const nombre = nombreQuinielaTemporal;
cerrarModalConfirmar();
try {
console.log("Confirmando quiniela ID:", id, "Nombre:", nombre);
const response = await fetch(API_BASE + "/api/quinielas/" + id + "/confirmar", {
method: "PATCH",
headers: { "Content-Type": "application/json" }
});
const result = await response.json();
if (result.success) {
console.log("Confirmada:", result);
if (result.estado === "espera") {
showToast("⏸️ " + nombre + " fue a En Espera (límite alcanzado)", "error");
} else {
showToast("✅ " + nombre + " confirmada — Folio: " + result.quiniela.folio, "success");
}
cargarPendientesTabla();
cargarJugandoTabla();
cargarEsperaTabla();
updateHeroStats();
} else {
console.error("Error al confirmar:", result.error);
showToast("Error: " + (result.error || "No se pudo confirmar"), "error");
}
} catch (error) {
console.error("Error confirmando quiniela:", error);
showToast("Error de conexión", "error");
}
}
async function ejecutarRechazo() {
if (!quinielaIdTemporal) return;
const id = quinielaIdTemporal;
const nombre = nombreQuinielaTemporal;
cerrarModalRechazar();
try {
console.log('🗑️ Rechazando quiniela ID:', id, 'Nombre:', nombre);
const response = await fetch(API_BASE + '/api/quinielas/' + id + '/rechazar', {
method: 'DELETE'
});
const result = await response.json();
if (response.ok && result.success) {
console.log('🗑️ Eliminada:', result);
cargarPendientesTabla && cargarPendientesTabla();
cargarEsperaTabla && cargarEsperaTabla();
typeof cargarQuinielas === 'function' && cargarQuinielas();
updateHeroStats && updateHeroStats();
} else {
showToast('Error: ' + (result.error || 'No se pudo eliminar ❌'), 'error');
}
} catch (error) {
console.error('❌ Error rechazando quiniela:', error);
showToast('Error de conexión ❌', 'error');
}
}
function validarQuiniela(quiniela) {
const nombre = (quiniela.name || "").trim();
if (!nombre) {
return { valida: false, error: "Nombre vacío" };
}
if (!quiniela.predictions || Object.keys(quiniela.predictions).length === 0) {
return { valida: false, error: "Sin predicciones" };
}
const partidosIncompletos = partidos.filter(function(partido) {
const pred = quiniela.predictions[partido.id];
return !pred || pred.length === 0 || !["L", "E", "V"].includes(pred[0]);
});
if (partidosIncompletos.length > 0) {
return { valida: false, error: "Predicciones incompletas" };
}
return { valida: true, error: "" };
}
function mostrarModalCargando(cantidad) {
const existente = document.getElementById('modal-cargando');
if (existente) existente.remove();
const modal = document.createElement("div");
modal.id = "modal-cargando";
modal.style.cssText =
"position: fixed; top: 0; left: 0; right: 0; bottom: 0;" +
"background: rgba(0,0,0,0.9); z-index: 10000; display: flex;" +
"align-items: center; justify-content: center;";
modal.innerHTML =
"<div style=\"background: #fff; border-radius: 20px; padding: 30px; text-align: center; max-width: 300px; width: 100%;\">" +
"<div style=\"font-size: 60px; margin-bottom: 15px;\">⏳</div>" +
"<h2 style=\"color: #006847; margin: 0 0 10px 0; font-size: 20px; font-weight: 800;\">Enviando...</h2>" +
"<p style=\"color: #666; font-size: 14px;\">" + cantidad + " quiniela" + (cantidad === 1 ? "" : "s") + "</p>" +
"<div style=\"width: 100%; height: 4px; background: #e5e7eb; border-radius: 2px; margin-top: 15px; overflow: hidden;\">" +
"<div style=\"width: 100%; height: 100%; background: linear-gradient(90deg, #006847, #25D366); animation: loading 1.5s infinite;\"></div>" +
"</div>" +
"</div>";
document.body.appendChild(modal);
return modal;
}
/* = Tabla para las quinielas por confirmar= */
async function cargarPendientesTabla() {
const tbody = document.getElementById('pendientesTableBody');
const countElement = document.getElementById('totalQuinielasCount');
const resumenElement = document.getElementById('pendingCount');
if (!tbody) {
console.log('⚠️ No se encontró pendientesTableBody');
return;
}
try {
tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:#ffffff;">Cargando por confirmar ⏳ ...</td></tr>';
const vendedor = vendedorAdmin || localStorage.getItem('vendedor');
if (!vendedor) {
tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:#ffffff;">Vendedor no identificado ⚠️</td></tr>';
if (countElement) countElement.textContent = '0 En total';
if (resumenElement) resumenElement.textContent = '0';
return;
}
if (!partidos || partidos.length === 0) {
await cargarPartidos();
}
const headerCells = document.querySelectorAll('#adminPendientes .results-table thead .col-match');
headerCells.forEach(function(th) {
const index = parseInt(th.dataset.matchIndex, 10);
const partido = partidos[index - 1];
if (!partido) return;
th.innerHTML =
'<div class="match-header">' +
'<img src="' + partido.localLogo + '" alt="' + partido.local + '" class="match-logo">' +
'<span class="match-vs">vs</span>' +
'<img src="' + partido.visitanteLogo + '" alt="' + partido.visitante + '" class="match-logo">' +
'</div>';
});
const response = await fetch(API_BASE + '/api/pendientes?vendedor=' + encodeURIComponent(vendedor) + '&jornada=' + encodeURIComponent((jornadaActual && jornadaActual.nombre) || ''));
if (!response.ok) {
throw new Error('Error al cargar pendientes');
}
const data = await response.json();
const lista = data.pendientes || [];
if (!lista.length) {
tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:#ffffff;">No hay quinielas por confirmar ✅</td></tr>';
if (countElement) countElement.textContent = '0 En total';
if (resumenElement) resumenElement.textContent = '0';
return;
}
if (countElement) countElement.textContent = lista.length + ' En total';
if (resumenElement) resumenElement.textContent = String(lista.length);
tbody.innerHTML = lista.map(function(q) {
return (
'<tr class="admin-row" ' +
'data-id="' + q.id + '" ' +
'data-nombre="' + q.nombre + '" ' +
'data-vendedor="' + q.vendedor + '">' +
'<td class="col-name">' + q.nombre + '</td>' +
q.picks.map(function(pick) {
return '<td class="col-match"><span class="result-cell">' + pick + '</span></td>';
}).join('') +
'<td class="col-actions">' +
'<button class="btn-confirmar">Confirmar ✅</button>' +
'<button class="btn-rechazar">Rechazar ❌</button>' +
'</td>' +
'</tr>'
);
}).join('');
console.log('✅ ' + lista.length + ' quinielas pendientes cargadas para ' + vendedor);
} catch (error) {
console.error('Error cargando pendientes ❌:', error);
tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:#ffffff;">Error al cargar datos ❌</td></tr>';
if (countElement) countElement.textContent = '0 En total';
if (resumenElement) resumenElement.textContent = '0';
}
}
/* = Tabla para las quinielas en espera= */
async function cargarEsperaTabla() {
const tbody = document.getElementById('esperaTableBody');
const countElement = document.getElementById('esperaCount');
const resumenEspera = document.getElementById('waitingCount');
if (!tbody) {
console.log('⚠️ No se encontró esperaTableBody');
return;
}
try {
tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:#ffffff;">Cargando en espera ⏳...</td></tr>';
const vendedor = vendedorAdmin || localStorage.getItem('vendedor');
if (!vendedor) {
tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:#ffffff;">Vendedor no identificado ⚠️</td></tr>';
if (countElement) countElement.textContent = '0 en espera';
if (resumenEspera) resumenEspera.textContent = '0';
return;
}
if (!partidos || partidos.length === 0) {
await cargarPartidos();
}
const headerCells = document.querySelectorAll('#adminEspera .results-table thead .col-match');
headerCells.forEach(function(th) {
const index = parseInt(th.dataset.matchIndex, 10);
const partido = partidos[index - 1];
if (!partido) return;
th.innerHTML =
'<div class="match-header">' +
'<img src="' + partido.localLogo + '" alt="' + partido.local + '" class="match-logo">' +
'<span class="match-vs">vs</span>' +
'<img src="' + partido.visitanteLogo + '" alt="' + partido.visitante + '" class="match-logo">' +
'</div>';
});
const response = await fetch(API_BASE + '/api/espera?vendedor=' + encodeURIComponent(vendedor) + '&jornada=' + encodeURIComponent((jornadaActual && jornadaActual.nombre) || ''));
if (!response.ok) {
throw new Error('Error al cargar espera');
}
const data = await response.json();
const lista = data.espera || [];
if (!lista.length) {
tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:#ffffff;">No hay quinielas en espera ✅</td></tr>';
if (countElement) countElement.textContent = '0 en espera';
if (resumenEspera) resumenEspera.textContent = '0';
return;
}
if (countElement) countElement.textContent = lista.length + ' en espera';
if (resumenEspera) resumenEspera.textContent = String(lista.length);
tbody.innerHTML = lista.map(function(q) {
return (
'<tr class="admin-row">' +
'<td class="col-name">' + q.nombre + '</td>' +
q.picks.map(function(pick) {
return '<td class="col-match"><span class="result-cell">' + pick + '</span></td>';
}).join('') +
'<td class="col-actions">En espera ⏳</td>' +
'</tr>'
);
}).join('');
console.log('✅ ' + lista.length + ' quinielas en espera cargadas para ' + vendedor);
} catch (error) {
console.error('❌ Error cargando espera:', error);
tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:#ffffff;">Error al cargar datos ❌</td></tr>';
if (countElement) countElement.textContent = '0 en espera';
if (resumenEspera) resumenEspera.textContent = '0';
}
}
/* = Leer el vendedor desde el URL= */
function getQueryParam(name) {
const params = new URLSearchParams(window.location.search);
return params.get(name) || '';
}
const vendedorAdmin = getQueryParam('vendedor');
/* = Tabla que trabaja en las quinielas jugando = */
async function cargarJugandoTabla() {
const tbody = document.getElementById('jugandoTableBody');
const countElement = document.getElementById('jugandoCount');
const resumenJugando = document.getElementById('playingCount');
if (!tbody) {
console.log('⚠️ No se encontró jugandoTableBody');
return;
}
try {
const vendedor = vendedorAdmin || localStorage.getItem('vendedor');
if (!vendedor) {
tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:40px; color:#ffffff;">Vendedor no identificado ⚠️</td></tr>';
if (countElement) countElement.textContent = '0 jugando';
if (resumenJugando) resumenJugando.textContent = '0';
return;
}
if (!partidos || partidos.length === 0) {
await cargarPartidos();
}
const headerCells = document.querySelectorAll('#adminJugando .results-table thead .col-match');
headerCells.forEach(function(th) {
const index = parseInt(th.dataset.matchIndex, 10);
const partido = partidos[index - 1];
if (!partido) return;
th.innerHTML =
'<div class="match-header">' +
'<img src="' + partido.localLogo + '" alt="' + partido.local + '" class="match-logo">' +
'<span class="match-vs">vs</span>' +
'<img src="' + partido.visitanteLogo + '" alt="' + partido.visitante + '" class="match-logo">' +
'</div>';
});
const [responseJugando, responseResultados] = await Promise.all([
fetch(API_BASE + '/api/jugando?vendedor=' + encodeURIComponent(vendedor) + '&jornada=' + encodeURIComponent((jornadaActual && jornadaActual.nombre) || '')),
fetch(API_BASE + '/api/resultados-oficiales')
]);
if (!responseJugando.ok || !responseResultados.ok) {
throw new Error('Error al cargar datos');
}
const dataJugando = await responseJugando.json();
const dataResultados = await responseResultados.json();
const lista = dataJugando.jugando || [];
const resultadosObj = dataResultados.resultados || {};
if (!lista.length) {
tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:40px; color:#ffffff;">No tienes quinielas jugando ✅</td></tr>';
if (countElement) countElement.textContent = '0 jugando';
if (resumenJugando) resumenJugando.textContent = '0';
return;
}
const listaConPuntos = lista.map(function(q) {
let puntos = 0;
if (!q.picks || !Array.isArray(q.picks)) {
console.warn('⚠️ Quiniela sin picks:', q);
return Object.assign({}, q, { puntos: 0 });
}
for (let i = 0; i < 9; i++) {
const pick = q.picks[i];
const resultado = resultadosObj[String(i)];
if (resultado && pick && pick === resultado) {
puntos++;
}
}
return Object.assign({}, q, { puntos: puntos });
});
listaConPuntos.sort(function(a, b) {
if (b.puntos !== a.puntos) return b.puntos - a.puntos;
const folioA = parseInt(a.folio) || 0;
const folioB = parseInt(b.folio) || 0;
return folioA - folioB;
});
const primerPuntos = listaConPuntos[0] ? listaConPuntos[0].puntos : 0;
const segundoObj = listaConPuntos.find(function(q) { return q.puntos < primerPuntos; });
const segundoPuntos = segundoObj ? segundoObj.puntos : 0;
if (countElement) countElement.textContent = lista.length + ' jugando';
if (resumenJugando) resumenJugando.textContent = String(lista.length);
tbody.innerHTML = listaConPuntos.map(function(q) {
const esPrimero = q.puntos === primerPuntos;
const esSegundo = !esPrimero && segundoPuntos > 0 && q.puntos === segundoPuntos;
const pointsClass = esPrimero ? 'points-gold' : esSegundo ? 'points-silver' : 'points-normal';
const celdasPicks = (q.picks || []).map(function(pick, idx) {
const resultado = resultadosObj[String(idx)];
const cls = !resultado ? 'pending' : (pick === resultado ? 'correct' : 'incorrect');
return '<td class="col-match"><span class="result-cell ' + cls + '">' + (pick || '-') + '</span></td>';
}).join('');
return (
'<tr class="admin-row">' +
'<td class="col-folio">' + (q.folio || '-') + '</td>' +
'<td class="col-name">' + (q.nombre || 'Sin nombre') + '</td>' +
'<td class="col-vendor">' + (q.vendedor || 'Sin vendedor') + '</td>' +
celdasPicks +
'<td class="col-points"><span class="points-cell ' + pointsClass + '">' + q.puntos + '</span></td>' +
'</tr>'
);
}).join('');
console.log('✅ ' + lista.length + ' quinielas jugando cargadas para ' + vendedor);
} catch (error) {
console.error('❌ Error cargando jugando:', error);
tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:40px; color:#ffffff;">Error al cargar datos ❌</td></tr>';
if (countElement) countElement.textContent = '0 jugando';
if (resumenJugando) resumenJugando.textContent = '0';
}
}
/* = Tabla que trabaja la lista oficial = */
async function cargarListaOficialTabla() {
const tbody = document.getElementById('listaOficialTableBody');
const countElement = document.getElementById('listaOficialCount');
const totalCount = document.getElementById('totalCount');
if (!tbody) {
console.log('⚠️ No se encontró listaOficialTableBody');
return;
}
try {
tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:40px; color:#ffffff;">Cargando lista oficial ⏳ ...</td></tr>';
const [responseOficial, responseResultados] = await Promise.all([
fetch(API_BASE + '/api/lista-oficial'),
fetch(API_BASE + '/api/resultados-oficiales')
]);
if (!responseOficial.ok || !responseResultados.ok) {
throw new Error('Error al cargar datos');
}
const dataOficial = await responseOficial.json();
const dataResultados = await responseResultados.json();
const lista = dataOficial.quinielas || [];
const resultadosObj = dataResultados.resultados || {};
console.log('📊 Quinielas cargadas:', lista.length);
console.log('📊 Resultados oficiales:', resultadosObj);
if (totalCount) totalCount.textContent = String(lista.length);
if (!lista.length) {
tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:40px; color:#ffffff;">No hay quinielas en lista oficial ✅</td></tr>';
if (countElement) countElement.textContent = '0 quinielas';
return;
}
const listaConPuntos = lista.map(function(q) {
let puntos = 0;
if (!q.picks || !Array.isArray(q.picks)) {
console.warn('⚠️ Quiniela sin picks:', q);
return Object.assign({}, q, { puntos: 0 });
}
for (let i = 0; i < 9; i++) {
const pick = q.picks[i];
const resultado = resultadosObj[String(i)];
if (resultado && pick && pick === resultado) {
puntos++;
}
}
return Object.assign({}, q, { puntos: puntos });
});
listaConPuntos.sort(function(a, b) {
if (b.puntos !== a.puntos) return b.puntos - a.puntos;
return (parseInt(a.folio) || 0) - (parseInt(b.folio) || 0);
});
const primerPuntos = listaConPuntos[0] ? listaConPuntos[0].puntos : 0;
const segundoObj = listaConPuntos.find(function(q) { return q.puntos < primerPuntos; });
const segundoPuntos = segundoObj ? segundoObj.puntos : 0;
console.log('🥇 Primer lugar:', primerPuntos, 'puntos');
console.log('🥈 Segundo lugar:', segundoPuntos, 'puntos');
if (countElement) countElement.textContent = lista.length + ' quinielas';
tbody.innerHTML = listaConPuntos.map(function(q) {
const esPrimero = q.puntos === primerPuntos;
const esSegundo = !esPrimero && segundoPuntos > 0 && q.puntos === segundoPuntos;
const pointsClass = esPrimero ? 'points-gold' : esSegundo ? 'points-silver' : 'points-normal';
const celdasPicks = (q.picks || []).map(function(pick, idx) {
const resultado = resultadosObj[String(idx)];
const cls = !resultado ? 'pending' : (pick === resultado ? 'correct' : 'incorrect');
return '<td class="col-match"><span class="result-cell ' + cls + '">' + (pick || '-') + '</span></td>';
}).join('');
return (
'<tr>' +
'<td class="col-folio">' + (q.folio || '-') + '</td>' +
'<td class="col-name">' + (q.nombre || 'Sin nombre') + '</td>' +
'<td class="col-vendor">' + (q.vendedor || 'Sin vendedor') + '</td>' +
celdasPicks +
'<td class="col-points"><span class="points-cell ' + pointsClass + '">' + q.puntos + '</span></td>' +
'</tr>'
);
}).join('');
console.log('✅ ' + lista.length + ' quinielas en lista oficial cargadas');
} catch (error) {
console.error('❌ Error cargando lista oficial:', error);
tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:40px; color:#ffffff;">Error al cargar datos ❌</td></tr>';
if (countElement) countElement.textContent = '0 quinielas';
}
}
/* =Navegacion de las subpestañas como Horarios , porcentajes , 1 lugar , listas= */
document.addEventListener('DOMContentLoaded', function() {
const analisisTabs = document.querySelectorAll('#pageAnalisis .tab-btn');
const analisisContents = document.querySelectorAll('#pageAnalisis .tab-content');
analisisTabs.forEach(btn => {
btn.addEventListener('click', function() {
const tab = this.getAttribute('data-tab');
analisisTabs.forEach(b => b.classList.remove('active'));
analisisContents.forEach(c => c.classList.remove('active'));
this.classList.add('active');
const content = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
if (content) content.classList.add('active');
if (tab === 'horarios') renderMatchesHorarios();
if (tab === 'porcentajes') renderMatchesPorcentajes();
});
});
const resultadosTabs = document.querySelectorAll('#pageResultados .tab-btn');
const resultadosContents = document.querySelectorAll('#pageResultados .tab-content');
resultadosTabs.forEach(btn => {
btn.addEventListener('click', function() {
const tab = this.getAttribute('data-tab');
resultadosTabs.forEach(b => b.classList.remove('active'));
resultadosContents.forEach(c => c.classList.remove('active'));
this.classList.add('active');
const content = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
if (content) content.classList.add('active');
if (tab === 'jugadas') {
if (typeof renderMyQuinielas === 'function') {
renderMyQuinielas();
}
}
if (tab === 'listaGeneral') {
console.log('📋 Lista general: cargarListaOficialTabla');
if (typeof cargarListaOficialTabla === 'function') {
cargarListaOficialTabla();
} else {
console.error('cargarListaOficialTabla no existe');
}
}
if (tab === 'podio1') {
if (typeof quiniela !== 'undefined' && quiniela.initFirstPlacePage) {
quiniela.initFirstPlacePage();
}
}
if (tab === 'podio2') {
if (typeof quiniela !== 'undefined' && quiniela.initSecondPlacePage) {
quiniela.initSecondPlacePage();
}
}
if (tab === 'verificar') {
const searchInput = document.getElementById('searchInput');
if (searchInput) {
searchInput.value = '';
if (typeof quiniela !== 'undefined' && quiniela.searchParticipant) {
quiniela.searchParticipant();
}
}
}
if (tab === 'simulador') {
if (typeof simulador !== 'undefined' && simulador.init) {
simulador.init();
}
}
});
});
});