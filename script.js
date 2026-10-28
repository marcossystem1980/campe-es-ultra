'use strict';

const STORAGE_KEY = 'copaColaboradores2026_v1';
const DEFAULT_SETTINGS = {
  eventName: 'Copa dos Colaboradores 2026',
  companyName: '',
  teamCount: 6,
  playersPerTeam: 5,
  companyLogo: null
};
const PLAYER_LEVELS = { 1: 'Iniciante', 2: 'Básico', 3: 'Intermediário', 4: 'Avançado', 5: 'Destaque' };
const TEAM_COLORS = ['#e6bd67', '#6ce0a5', '#79b8ed', '#f07f73', '#b59aec', '#f2a65a', '#58ced0', '#e78fbe', '#a7c86a', '#9ab8d8', '#e8d16b', '#f19a7c', '#82d3b6', '#b1a4ee', '#d9a45c', '#8bc0d5'];
const CRESTS = ['⚽', '★', '🦁', '🦅', '🐺', '🔥', '⚡', '🌟', '🛡', '👑'];
const ROUND_NAMES = { 1: 'FINAL', 2: 'SEMIFINAL', 4: 'QUARTAS DE FINAL', 8: 'OITAVAS DE FINAL', 16: '32 AVOS DE FINAL' };

function freshState() {
  return { settings: { ...DEFAULT_SETTINGS }, players: [], playerLevels: {}, teams: [], bracket: [], createdAt: null };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    const base = freshState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      players: Array.isArray(parsed.players) ? parsed.players : [],
      playerLevels: parsed.playerLevels && typeof parsed.playerLevels === 'object' ? parsed.playerLevels : {},
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      bracket: Array.isArray(parsed.bracket) ? parsed.bracket : []
    };
  } catch (error) {
    console.warn('Não foi possível carregar o campeonato salvo.', error);
    return freshState();
  }
}
let state = loadState();
let currentView = 'dashboard';
let editingMatchId = null;

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const getTeam = (id) => state.teams.find((team) => team.id === id) || null;
const totalBracketMatches = () => state.bracket.reduce((sum, round) => sum + round.length, 0);
const countPlayedMatches = () => state.bracket.reduce((sum, round) => sum + round.filter((match) => match.team1Id && match.team2Id && match.winnerId).length, 0);
const getChampion = () => state.bracket.length ? state.bracket[state.bracket.length - 1][0]?.winnerId || null : null;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(error);
    toast('Não foi possível salvar. A imagem do logo pode ser grande demais; remova-a ou use uma versão menor.', 'error');
  }
}
function toast(message, type = 'success') {
  const region = $('toastRegion');
  if (!region) return;
  const item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : ''}`;
  item.textContent = message;
  region.appendChild(item);
  window.setTimeout(() => item.remove(), 3800);
}
function normalizeName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim();
}
function playerKey(name) {
  return normalizeName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}
function getPlayerLevel(name) {
  const value = Number(state.playerLevels?.[playerKey(name)] || 0);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
}
function getAverageLevel(names) {
  const levels = (names || []).map(getPlayerLevel).filter(Boolean);
  return levels.length ? levels.reduce((sum, level) => sum + level, 0) / levels.length : 0;
}
function formatLevelAverage(value) {
  return value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
}
function parseNames(raw) {
  const values = String(raw ?? '').split(/[\r\n,;]+/).map(normalizeName).filter(Boolean);
  const unique = [];
  const seen = new Set();
  let duplicates = 0;
  values.forEach((name) => {
    const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);
    unique.push(name);
  });
  return { names: unique, duplicates, originalCount: values.length };
}
function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function createId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function setView(view) {
  if (!['dashboard', 'participants', 'teams', 'bracket', 'settings'].includes(view)) return;
  currentView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  const labels = { dashboard: 'VISÃO GERAL', participants: 'PARTICIPANTES', teams: 'TIMES', bracket: 'CHAVEAMENTO', settings: 'CONFIGURAÇÕES' };
  $('breadcrumbCurrent').textContent = labels[view] || 'CAMPEONATO';
  $('sidebar').classList.remove('open');
  if (view === 'settings') fillIdentityInputs();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function updateCounters() {
  const played = countPlayedMatches();
  const total = totalBracketMatches();
  const teams = state.teams.length;
  const champion = getChampion();
  $('statParticipants').textContent = state.players.length;
  $('statTeams').textContent = teams;
  $('statTeamsNote').textContent = teams ? `${teams} equipes formadas` : 'Aguardando sorteio';
  $('statPlayed').innerHTML = `${played}<span class="stat-total" id="statTotal"> / ${total}</span>`;
  $('statChampion').textContent = champion ? (getTeam(champion)?.name || 'Campeão') : '—';
  $('championNote').textContent = champion ? 'A taça tem dono!' : 'O troféu está em jogo';
  $('participantProgress').style.width = `${Math.min(100, state.players.length / 48 * 100)}%`;
  $('teamProgress').style.width = `${teams ? 100 : 0}%`;
  $('matchProgress').style.width = `${total ? played / total * 100 : 0}%`;
  $('navParticipantCount').textContent = state.players.length;
  $('eventStatus').textContent = champion ? 'CAMPEÃO DEFINIDO' : state.bracket.length ? 'EM DISPUTA' : teams ? 'TIMES SORTEADOS' : state.players.length ? 'INSCRIÇÕES ABERTAS' : 'PRÉ-TEMPORADA';
  $('todayLabel').textContent = '29 OUT 2026 · DIA DE JOGO';
}
function renderParticipants() {
  const input = $('participantInput');
  if (input && input.dataset.initialized !== 'true') { input.value = state.players.join('\n'); input.dataset.initialized = 'true'; }
  const parsed = parseNames(input?.value || '');
  $('draftCounter').textContent = `${parsed.names.length} nomes`;
  $('participantBigCount').textContent = state.players.length;
  $('savedCounter').textContent = `${state.players.length} inscritos`;
  $('plannedTeams').textContent = clampNumber($('teamCount')?.value || state.settings.teamCount, 2, 16, 6);
  $('plannedStarters').textContent = clampNumber($('playersPerTeam')?.value || state.settings.playersPerTeam, 1, 30, 5);
  const teamCount = clampNumber($('teamCount')?.value || state.settings.teamCount, 2, 16, 6);
  $('plannedDistribution').textContent = state.players.length ? `${Math.floor(state.players.length / teamCount)}–${Math.ceil(state.players.length / teamCount)} por time` : 'Aguardando lista';
  $('duplicateHint').textContent = parsed.duplicates ? `${parsed.duplicates} duplicado(s) na área de texto` : '';

  const container = $('savedParticipants');
  const rated = state.players.filter((name) => getPlayerLevel(name) > 0).length;
  const missing = state.players.length - rated;
  $('playerLevelProgress').textContent = state.players.length ? `${rated}/${state.players.length} avaliados` : '0/0 avaliados';
  $('playerLevelProgress').classList.toggle('complete', state.players.length > 0 && missing === 0);
  $('playerLevelProgress').classList.toggle('incomplete', missing > 0);
  $('levelNotice').classList.toggle('ready', state.players.length > 0 && missing === 0);
  $('levelNotice').textContent = !state.players.length
    ? 'Salve a lista de participantes para começar a avaliação.'
    : missing
      ? `Faltam avaliar ${missing} participante(s). O sorteio fica bloqueado até todos receberem um nível de 1 a 5.`
      : 'Todos foram avaliados. O sistema já pode distribuir os níveis de forma equilibrada entre as equipes.';

  if (!state.players.length) {
    container.innerHTML = '<div class="empty-inline">Nenhum participante cadastrado ainda. Importe ou cole a lista acima e clique em “Salvar lista”.</div>';
  } else {
    container.innerHTML = state.players.map((name, index) => {
      const level = getPlayerLevel(name);
      const levelLabel = level ? PLAYER_LEVELS[level] : 'Nível não definido';
      const stars = [1, 2, 3, 4, 5].map((star) => `
          <button type="button" class="rating-star ${star <= level ? 'is-filled' : ''} ${star === level ? 'is-selected' : ''}"
            data-player-level data-player-index="${index}" data-level="${star}"
            aria-label="${escapeHtml(name)}: definir nível ${star}, ${escapeHtml(PLAYER_LEVELS[star])}"
            aria-pressed="${star === level ? 'true' : 'false'}" title="${star} estrela${star > 1 ? 's' : ''} · ${escapeHtml(PLAYER_LEVELS[star])}">★</button>`).join('');
      return `<div class="rating-row ${level ? 'rated' : 'unrated'}">
        <span class="rating-index">${String(index + 1).padStart(2, '0')}</span>
        <div class="rating-person"><strong>${escapeHtml(name)}</strong><small>${level ? `${level} ${level === 1 ? 'estrela' : 'estrelas'} · ${escapeHtml(levelLabel)}` : 'Clique nas estrelas para avaliar'}</small></div>
        <div class="rating-stars" role="group" aria-label="Avaliação de ${escapeHtml(name)}">${stars}</div>
      </div>`;
    }).join('');
  }
}
function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function renderTeamCard(team, index) {
  const starters = team.players.slice(0, state.settings.playersPerTeam);
  const reserves = team.players.slice(state.settings.playersPerTeam);
  const logo = escapeHtml(team.crest || '⚽');
  const roster = (list, start, reserve) => list.length ? list.map((name, i) => {
    const level = getPlayerLevel(name);
    return `<div class="roster-player ${reserve ? 'reserve' : ''}"><span class="player-number">${reserve ? 'R' : String(start + i + 1).padStart(2, '0')}</span><span class="roster-player-name">${escapeHtml(name)}</span><span class="player-level-tag" data-level="${level || 0}" title="${level ? `Nível ${level} · ${PLAYER_LEVELS[level]}` : 'Nível não definido'}">${level ? `N${level}` : 'N/A'}</span></div>`;
  }).join('') : '<div class="roster-empty">Nenhum jogador nesta lista.</div>';
  const crestButtons = CRESTS.map((crest) => `<button type="button" class="crest-choice ${team.crest === crest ? 'selected' : ''}" data-crest-team="${team.id}" data-crest="${escapeHtml(crest)}" aria-label="Escolher escudo ${escapeHtml(crest)}">${crest}</button>`).join('');
  const teamAverage = getAverageLevel(team.players);
  const starterAverage = getAverageLevel(starters);
  return `<article class="team-card" style="--team-color:${escapeHtml(team.color)}">
    <div class="team-card-head"></div><div class="team-card-inner">
      <div class="team-card-top"><div class="team-crest">${logo}</div><div class="team-heading-info"><input aria-label="Nome do time" data-team-name="${team.id}" maxlength="28" value="${escapeHtml(team.name)}" /><small>EQUIPE ${String(index + 1).padStart(2, '0')}</small></div><label class="team-edit-color" title="Alterar cor"><input type="color" data-team-color="${team.id}" value="${escapeHtml(team.color)}" aria-label="Cor do time" /></label></div>
      <div class="team-crest-select"><span class="roster-empty">ESCUDO</span>${crestButtons}</div>
      <div class="team-strength-strip"><div><span>FORÇA DO ELENCO</span><strong>${formatLevelAverage(teamAverage)} <small>/ 5</small></strong></div><div><span>MÉDIA DOS TITULARES</span><strong>${formatLevelAverage(starterAverage)} <small>/ 5</small></strong></div></div>
      <div class="team-roster-stats"><div class="roster-stat"><strong>${starters.length}</strong><span>EM CAMPO</span></div><div class="roster-stat"><strong>${reserves.length}</strong><span>RESERVAS</span></div></div>
      <div class="roster-section"><div class="roster-section-title">ESCALAÇÃO INICIAL <span>${starters.length} jogador(es)</span></div><div class="roster-list">${roster(starters, 0, false)}</div></div>
      <div class="roster-section"><div class="roster-section-title">BANCO DE RESERVAS <span>${reserves.length} jogador(es)</span></div><div class="roster-list">${roster(reserves, state.settings.playersPerTeam, true)}</div></div>
    </div></article>`;
}
function renderTeams() {
  $('teamCount').value = state.settings.teamCount;
  $('playersPerTeam').value = state.settings.playersPerTeam;
  $('drawParticipantCount').textContent = state.players.length;
  const teamCount = state.settings.teamCount;
  const minExpected = Math.floor(state.players.length / Math.max(1, teamCount));
  const maxExpected = Math.ceil(state.players.length / Math.max(1, teamCount));
  $('drawSummaryText').textContent = state.players.length ? `Aproximadamente ${minExpected}${minExpected !== maxExpected ? `–${maxExpected}` : ''} por equipe.` : 'Cadastre os participantes primeiro.';
  $('teamCountBadge').textContent = `${state.teams.length} equipes`;
  const unratedCount = state.players.filter((name) => getPlayerLevel(name) === 0).length;
  $('drawTeamsBtn').disabled = state.players.length < 2 || unratedCount > 0;
  const warning = $('drawWarning');
  if (state.players.length && state.players.length < teamCount) {
    warning.hidden = false;
    warning.textContent = 'Atenção: há menos participantes do que times. Diminua a quantidade de equipes ou adicione mais nomes.';
  } else if (unratedCount > 0) {
    warning.hidden = false;
    warning.textContent = `Falta avaliar ${unratedCount} participante(s). Acesse Participantes e escolha um nível de futebol de 1 a 5 para cada pessoa.`;
  } else if (state.teams.length && state.teams.length !== teamCount) {
    warning.hidden = false;
    warning.textContent = 'A quantidade de times foi alterada. Clique em “Sortear equipes” para aplicar a nova configuração; isso substituirá o sorteio atual.';
  } else {
    warning.hidden = true;
  }
  const container = $('teamsGrid');
  if (!state.teams.length) {
    container.innerHTML = '<div class="empty-state full-empty"><span>♜</span><strong>Suas equipes ainda não foram sorteadas</strong><p>Cadastre os participantes, escolha as regras e clique em “Sortear equipes”.</p><button class="btn btn-outline" data-go="participants">Ir para participantes</button></div>';
  } else {
    container.innerHTML = state.teams.map(renderTeamCard).join('');
  }
}
function roundLabel(index, total) {
  if (index === total - 1) return 'GRANDE FINAL';
  const count = state.bracket[index]?.length || 0;
  if (index === 0 && state.teams.length === 4) return 'SEMIFINAL';
  if (ROUND_NAMES[count]) return ROUND_NAMES[count];
  if (count === 2 && index > 0) return 'SEMIFINAL';
  return index === 0 ? 'RODADA INICIAL' : `RODADA ${index + 1}`;
}
function teamInitial(team) {
  if (!team) return '—';
  return String(team.name || 'TM').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'TM';
}
function renderMatch(match, roundIndex, matchIndex) {
  const team1 = getTeam(match.team1Id);
  const team2 = getTeam(match.team2Id);
  const canPlay = !!team1 && !!team2;
  const isBye = match.decision === 'bye' && !!(team1 || team2);
  const complete = !!match.winnerId && !isBye;
  const editing = editingMatchId === match.id;
  const winner = getTeam(match.winnerId);
  const penaltyNeeded = canPlay && (editing || !complete) && match.score1 !== '' && match.score2 !== '' && Number(match.score1) === Number(match.score2);
  const statusText = isBye ? 'FOLGA' : editing ? 'EDITANDO PLACAR' : complete ? 'FINALIZADO' : canPlay ? 'AGUARDANDO RESULTADO' : 'A DEFINIR';
  const row = (team, scoreValue, slot) => {
    const won = match.winnerId && match.winnerId === team?.id;
    const scoreHtml = isBye ? '' : (complete && !editing
      ? `<span class="match-score">${escapeHtml(scoreValue ?? '')}</span>`
      : canPlay ? `<input class="match-score-input" type="number" min="0" max="99" inputmode="numeric" data-score="${slot}" value="${escapeHtml(scoreValue ?? '')}" aria-label="Placar ${escapeHtml(team?.name || 'time')}" />` : '<span class="match-score">—</span>');
    const crestHtml = team ? `<span class="match-team-crest" style="background:${escapeHtml(team.color)}">${escapeHtml(team.crest || teamInitial(team))}</span>` : '<span class="match-team-crest" style="background:#344452;color:#a8b6c1">?</span>';
    return `<div class="match-team-row ${won ? 'winner-row' : ''}">${crestHtml}<span class="match-team-name">${escapeHtml(team?.name || (isBye ? '—' : 'A definir'))}</span>${scoreHtml}</div>`;
  };
  let bottom = '';
  if (isBye) {
    bottom = `<div class="match-bottom"><div class="match-hint">${escapeHtml(winner?.name || 'Equipe')} avança automaticamente.</div></div>`;
  } else if (canPlay && complete && !editing) {
    bottom = `<div class="match-bottom"><div class="match-actions"><span class="match-hint">Vencedor: ${escapeHtml(winner?.name || '—')}</span><button type="button" class="match-small-button" data-edit-match="${match.id}">Editar placar</button></div></div>`;
  } else if (canPlay) {
    const penaltyOptions = `<option value="">Escolha quem venceu nos pênaltis</option><option value="${team1.id}" ${match.winnerId === team1.id ? 'selected' : ''}>${escapeHtml(team1.name)}</option><option value="${team2.id}" ${match.winnerId === team2.id ? 'selected' : ''}>${escapeHtml(team2.name)}</option>`;
    bottom = `<div class="match-bottom"><select class="penalty-select" data-penalty ${penaltyNeeded ? '' : 'hidden'}>${penaltyOptions}</select><div class="match-actions"><span class="match-hint">${editing ? 'Ajuste e salve o placar' : 'Informe o placar final'}</span><button type="button" class="match-small-button" data-save-match="${match.id}">${editing ? 'Salvar alteração' : 'Salvar placar'}</button></div></div>`;
  } else {
    bottom = `<div class="match-bottom"><div class="match-hint">${team1 || team2 ? 'Aguardando o outro confronto para definir a partida.' : 'O confronto será definido após as rodadas anteriores.'}</div></div>`;
  }
  return `<article class="bracket-match ${complete ? 'complete-match' : 'pending-match'} ${isBye ? 'bye-match' : ''}" data-match-id="${match.id}">
    <div class="match-head"><span>JOGO ${String(matchIndex + 1).padStart(2, '0')}</span><span class="match-status ${complete ? 'done' : isBye ? 'bye' : ''}">${statusText}</span></div>
    ${row(team1, match.score1, 'one')}${row(team2, match.score2, 'two')}${bottom}
  </article>`;
}
function renderBracket() {
  const board = $('bracketBoard');
  const notice = $('bracketNotice');
  const championId = getChampion();
  if (!state.bracket.length) {
    board.innerHTML = '<div class="empty-state full-empty"><span>⌘</span><strong>O caminho até a final será desenhado aqui</strong><p>Assim que os times estiverem definidos, o sistema monta as rodadas automaticamente.</p><button class="btn btn-outline" data-go="teams">Configurar e sortear times</button></div>';
    notice.hidden = false;
  } else {
    notice.hidden = true;
    board.innerHTML = state.bracket.map((round, roundIndex) => `<section class="bracket-round"><div class="bracket-round-title">${roundLabel(roundIndex, state.bracket.length)}<span>${round.length} ${round.length === 1 ? 'JOGO' : 'JOGOS'}</span></div>${round.map((match, matchIndex) => renderMatch(match, roundIndex, matchIndex)).join('')}</section>`).join('');
  }
  const banner = $('championBanner');
  if (championId) {
    banner.hidden = false;
    $('championNameBanner').textContent = getTeam(championId)?.name || 'CAMPEÃO';
  } else banner.hidden = true;
}
function renderNextMatches() {
  const container = $('nextMatches');
  if (!state.bracket.length) {
    container.innerHTML = '<div class="empty-state compact-empty"><span>⚽</span><strong>O campo está esperando</strong><p>Adicione os participantes e realize o sorteio para montar o campeonato.</p><button class="btn btn-small btn-outline" data-go="participants">Começar agora</button></div>';
    return;
  }
  const pending = [];
  state.bracket.forEach((round, roundIndex) => round.forEach((match, matchIndex) => {
    if (match.team1Id && match.team2Id && !match.winnerId) pending.push({ match, roundIndex, matchIndex });
  }));
  if (!pending.length) {
    const champ = getChampion();
    container.innerHTML = champ ? `<div class="empty-state compact-empty"><span>🏆</span><strong>Campeonato encerrado!</strong><p>${escapeHtml(getTeam(champ)?.name || 'O campeão')} conquistou o título.</p><button class="btn btn-small btn-outline" data-go="bracket">Ver campeão</button></div>` : '<div class="empty-state compact-empty"><span>⚽</span><strong>Rodadas em preparação</strong><p>Os próximos jogos serão definidos conforme os resultados forem registrados.</p></div>';
    return;
  }
  container.innerHTML = pending.slice(0, 3).map(({ match, roundIndex, matchIndex }) => {
    const a = getTeam(match.team1Id), b = getTeam(match.team2Id);
    return `<div class="next-match-item"><div class="next-team"><span class="mini-crest" style="background:${escapeHtml(a.color)}">${escapeHtml(a.crest || teamInitial(a))}</span><span>${escapeHtml(a.name)}</span></div><div class="vs-block"><b>VS</b><small>${roundLabel(roundIndex, state.bracket.length)}</small></div><div class="next-team right"><span class="mini-crest" style="background:${escapeHtml(b.color)}">${escapeHtml(b.crest || teamInitial(b))}</span><span>${escapeHtml(b.name)}</span></div></div>`;
  }).join('');
}
function fillIdentityInputs() {
  const eventInput = $('eventNameInput');
  const companyInput = $('companyNameInput');
  if (eventInput) eventInput.value = state.settings.eventName || DEFAULT_SETTINGS.eventName;
  if (companyInput) companyInput.value = state.settings.companyName || '';
  updateIdentityPreview();
}

// Atualiza a identidade publicada em todos os pontos comuns do site.
// A função usa o estado salvo; os campos em edição são tratados separadamente.
function updatePublishedIdentity() {
  const name = normalizeName(state.settings.eventName) || DEFAULT_SETTINGS.eventName;
  const company = normalizeName(state.settings.companyName);
  const companyLabel = company || 'EVENTO CORPORATIVO';
  const logo = state.settings.companyLogo || null;
  const upperName = name.toLocaleUpperCase('pt-BR');
  const upperCompany = companyLabel.toLocaleUpperCase('pt-BR');

  document.title = name;
  const titleMeta = document.querySelector('meta[name="theme-color"]');
  if (titleMeta) titleMeta.content = '#0b1420';

  // Marca permanente na lateral e no cabeçalho: fica visível em todas as telas.
  $('sideEventName').textContent = upperName;
  $('sideCompanyName').textContent = upperCompany;
  const side = $('sideEmblem');
  if (logo) {
    side.classList.add('has-logo');
    side.innerHTML = `<img src="${escapeHtml(logo)}" alt="Logo da empresa" />`;
  } else {
    side.classList.remove('has-logo');
    side.innerHTML = 'CC<span>26</span>';
  }

  $('topbarEventName').textContent = upperName;
  $('topbarCompanyName').textContent = upperCompany;
  const topbarLogo = $('topbarIdentityLogo');
  const topbarLogoImg = $('topbarIdentityLogoImg');
  const topbarFallback = $('topbarIdentityFallback');
  if (logo) {
    topbarLogo.classList.add('has-logo');
    topbarLogoImg.src = logo;
    topbarLogoImg.hidden = false;
    topbarFallback.hidden = true;
  } else {
    topbarLogo.classList.remove('has-logo');
    topbarLogoImg.removeAttribute('src');
    topbarLogoImg.hidden = true;
    topbarFallback.hidden = false;
    topbarFallback.textContent = 'CC';
  }

  // A página inicial também usa a identidade configurada, em vez de um título fixo.
  $('heroEventName').textContent = upperName;
  $('heroCompanyLine').textContent = company || 'Um só objetivo. Uma equipe campeã.';
  $('footerEventName').textContent = upperName;

  // A folha impressa do chaveamento precisa carregar a mesma identidade.
  $('printEventName').textContent = upperName;
  $('printCompanyName').textContent = upperCompany;
  const printLogo = $('printCompanyLogo');
  if (logo) {
    printLogo.src = logo;
    printLogo.hidden = false;
  } else {
    printLogo.removeAttribute('src');
    printLogo.hidden = true;
  }
}

// Atualiza a prévia do formulário usando os valores que estão sendo editados,
// sem sobrescrever os campos nem apagar alterações ainda não salvas.
function updateIdentityPreview() {
  const eventInput = $('eventNameInput');
  const companyInput = $('companyNameInput');
  const name = normalizeName(eventInput?.value) || DEFAULT_SETTINGS.eventName;
  const company = normalizeName(companyInput?.value) || 'TEMPORADA 2026 · DIA DE JOGO';
  const logo = state.settings.companyLogo || null;
  $('previewEventName').textContent = name.toLocaleUpperCase('pt-BR');
  $('previewCompanyName').textContent = company.toLocaleUpperCase('pt-BR');

  const preview = $('previewMark');
  const logoImg = $('companyLogoPreview');
  const fallback = $('logoPreviewFallback');
  if (logo) {
    preview.classList.add('has-logo');
    preview.innerHTML = `<img src="${escapeHtml(logo)}" alt="Logo de destaque do evento" />`;
    logoImg.src = logo;
    logoImg.hidden = false;
    fallback.hidden = true;
    $('removeLogoBtn').hidden = false;
  } else {
    preview.classList.remove('has-logo');
    preview.textContent = 'CC';
    logoImg.removeAttribute('src');
    logoImg.hidden = true;
    fallback.hidden = false;
    $('removeLogoBtn').hidden = true;
  }
}
function renderAll() {
  updateCounters();
  renderParticipants();
  renderTeams();
  renderBracket();
  renderNextMatches();
  updatePublishedIdentity();
  updateIdentityPreview();
  $('teamCount').value = state.settings.teamCount;
  $('playersPerTeam').value = state.settings.playersPerTeam;
}
function invalidateTournament() {
  state.teams = [];
  state.bracket = [];
  state.createdAt = null;
}
function saveParticipantList(options = {}) {
  const parsed = parseNames($('participantInput').value);
  if (parsed.names.length < 2) {
    toast('Adicione pelo menos 2 participantes para organizar o campeonato.', 'warning');
    return false;
  }
  const changed = JSON.stringify(parsed.names) !== JSON.stringify(state.players);
  if (changed && state.teams.length && !options.skipConfirm) {
    const okay = window.confirm('A lista mudou. Para manter o sorteio correto, os times e o chaveamento atuais serão apagados. Deseja continuar?');
    if (!okay) return false;
  }
  if (changed) invalidateTournament();
  state.players = parsed.names;
  const validPlayerKeys = new Set(parsed.names.map(playerKey));
  Object.keys(state.playerLevels || {}).forEach((key) => { if (!validPlayerKeys.has(key)) delete state.playerLevels[key]; });
  $('participantInput').value = parsed.names.join('\n');
  persist();
  renderAll();
  if (parsed.duplicates) toast(`${parsed.duplicates} nome(s) repetido(s) foram ignorados. Lista salva com ${parsed.names.length} participantes.`, 'warning');
  else toast(`Lista salva: ${parsed.names.length} participantes.`);
  return true;
}
function makeTeams() {
  const rawNames = parseNames($('participantInput').value).names;
  if (JSON.stringify(rawNames) !== JSON.stringify(state.players)) {
    const saved = saveParticipantList({ skipConfirm: !state.teams.length });
    if (!saved) return;
  }
  if (state.players.length < 2) {
    toast('Cadastre pelo menos 2 participantes antes do sorteio.', 'warning');
    setView('participants');
    return;
  }
  const unassessed = state.players.filter((name) => getPlayerLevel(name) === 0);
  if (unassessed.length) {
    toast(`Avalie o nível de todos os participantes antes do sorteio. Faltam ${unassessed.length}.`, 'warning');
    setView('participants');
    const firstIndex = state.players.findIndex((name) => getPlayerLevel(name) === 0);
    window.setTimeout(() => document.querySelector(`[data-player-index="${firstIndex}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return;
  }
  const numberOfTeams = clampNumber($('teamCount').value, 2, 16, 6);
  const starters = clampNumber($('playersPerTeam').value, 1, 30, 5);
  if (state.players.length < numberOfTeams) {
    toast('A quantidade de times não pode ser maior que a de participantes.', 'warning');
    return;
  }
  if (state.teams.length && !window.confirm('Sortear novamente substituirá os times e o chaveamento atuais. Deseja continuar?')) return;
  state.settings.teamCount = numberOfTeams;
  state.settings.playersPerTeam = starters;
  const teams = Array.from({ length: numberOfTeams }, (_, index) => ({
    id: `team_${index + 1}_${createId('')}`,
    name: `TIME ${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) : ''}`,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    crest: CRESTS[index % CRESTS.length],
    players: []
  }));

  // Equilibra os níveis 5 → 1 por distribuição serpentina. Jogadores do mesmo nível
  // são embaralhados antes de serem distribuídos, então o sorteio continua aleatório.
  const rankedPlayers = [5, 4, 3, 2, 1].flatMap((level) =>
    shuffle(state.players.filter((name) => getPlayerLevel(name) === level))
  );
  const teamOrder = shuffle(teams);
  rankedPlayers.forEach((name, index) => {
    const row = Math.floor(index / numberOfTeams);
    const slot = index % numberOfTeams;
    const teamIndex = row % 2 === 0 ? slot : numberOfTeams - 1 - slot;
    teamOrder[teamIndex].players.push(name);
  });

  state.teams = teams;
  state.bracket = [];
  state.createdAt = new Date().toISOString();
  persist();
  renderAll();
  const averages = teams.map((team) => getAverageLevel(team.players));
  const spread = Math.max(...averages) - Math.min(...averages);
  toast(`Sorteio concluído! ${state.players.length} participantes em ${numberOfTeams} equipes. Diferença de média entre elencos: ${spread.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}.`);
}
function createBracket() {
  if (state.teams.length < 2) {
    toast('Primeiro, faça o sorteio dos times.', 'warning');
    setView('teams');
    return;
  }
  if (state.bracket.length && !window.confirm('Gerar um novo chaveamento apagará todos os placares atuais. Deseja continuar?')) return;
  editingMatchId = null;
  const shuffledTeams = shuffle(state.teams);
  let slots = 1;
  while (slots < shuffledTeams.length) slots *= 2;
  const byes = slots - shuffledTeams.length;
  const byePairs = Array.from({ length: byes }, (_, index) => [shuffledTeams[index].id, null]);
  const remaining = shuffledTeams.slice(byes);
  const playedPairs = [];
  for (let index = 0; index < remaining.length; index += 2) {
    playedPairs.push([remaining[index]?.id || null, remaining[index + 1]?.id || null]);
  }
  // Intercala as folgas com os confrontos reais para, quando possível, evitar que
  // todos os times beneficiados pela folga caiam na mesma metade da chave.
  const firstPairs = [];
  let byeIndex = 0;
  let playedIndex = 0;
  while (byeIndex < byePairs.length || playedIndex < playedPairs.length) {
    if (byeIndex < byePairs.length) firstPairs.push(byePairs[byeIndex++]);
    if (playedIndex < playedPairs.length) firstPairs.push(playedPairs[playedIndex++]);
  }
  while (firstPairs.length < slots / 2) firstPairs.push([null, null]);
  const firstRound = firstPairs.map(([team1Id, team2Id], index) => ({
    id: `r0_m${index}_${createId('match')}`,
    team1Id,
    team2Id,
    score1: '', score2: '',
    winnerId: team1Id && !team2Id ? team1Id : team2Id && !team1Id ? team2Id : null,
    decision: (team1Id && !team2Id) || (team2Id && !team1Id) ? 'bye' : 'pending'
  }));
  const rounds = [firstRound];
  let matchCount = firstRound.length / 2;
  let roundIndex = 1;
  while (matchCount >= 1) {
    rounds.push(Array.from({ length: matchCount }, (_, matchIndex) => ({
      id: `r${roundIndex}_m${matchIndex}_${createId('match')}`,
      team1Id: null, team2Id: null, score1: '', score2: '', winnerId: null, decision: 'pending'
    })));
    if (matchCount === 1) break;
    matchCount /= 2;
    roundIndex++;
  }
  state.bracket = rounds;
  syncBracket();
  persist();
  renderAll();
  toast('Chaveamento aleatório gerado! Os vencedores avançarão automaticamente.');
  setView('bracket');
}
function syncBracket() {
  for (let roundIndex = 1; roundIndex < state.bracket.length; roundIndex++) {
    const previousRound = state.bracket[roundIndex - 1];
    const round = state.bracket[roundIndex];
    round.forEach((match, index) => {
      const next1 = previousRound[index * 2]?.winnerId || null;
      const next2 = previousRound[index * 2 + 1]?.winnerId || null;
      if (match.team1Id !== next1 || match.team2Id !== next2) {
        match.team1Id = next1;
        match.team2Id = next2;
        match.score1 = '';
        match.score2 = '';
        match.winnerId = null;
        match.decision = 'pending';
      }
    });
  }
}
function saveMatchResult(matchId) {
  let target = null;
  let roundIndex = -1;
  for (let r = 0; r < state.bracket.length; r++) {
    const found = state.bracket[r].find((match) => match.id === matchId);
    if (found) { target = found; roundIndex = r; break; }
  }
  if (!target) return;
  const card = document.querySelector(`[data-match-id="${CSS.escape(matchId)}"]`);
  if (!card) return;
  const team1 = getTeam(target.team1Id), team2 = getTeam(target.team2Id);
  if (!team1 || !team2) {
    toast('Este confronto ainda não está pronto para receber resultado.', 'warning');
    return;
  }
  const scoreOneField = card.querySelector('[data-score="one"]');
  const scoreTwoField = card.querySelector('[data-score="two"]');
  const score1 = scoreOneField ? scoreOneField.value.trim() : String(target.score1 ?? '');
  const score2 = scoreTwoField ? scoreTwoField.value.trim() : String(target.score2 ?? '');
  if (score1 === '' || score2 === '' || !Number.isInteger(Number(score1)) || !Number.isInteger(Number(score2)) || Number(score1) < 0 || Number(score2) < 0) {
    toast('Informe um placar válido para os dois times.', 'warning');
    return;
  }
  let winnerId;
  if (Number(score1) > Number(score2)) winnerId = team1.id;
  else if (Number(score2) > Number(score1)) winnerId = team2.id;
  else {
    const penalty = card.querySelector('[data-penalty]');
    if (!penalty || !penalty.value) {
      toast('O placar está empatado. Escolha quem venceu nos pênaltis.', 'warning');
      if (penalty) { penalty.hidden = false; penalty.focus(); }
      return;
    }
    winnerId = penalty.value;
  }
  target.score1 = Number(score1);
  target.score2 = Number(score2);
  editingMatchId = null;
  target.winnerId = winnerId;
  target.decision = Number(score1) === Number(score2) ? 'penalties' : 'score';
  syncBracket();
  persist();
  renderAll();
  toast(`${getTeam(winnerId)?.name || 'Equipe'} avançou para a próxima fase.`);
}
function handleTeamChange(event) {
  const nameInput = event.target.closest('[data-team-name]');
  const colorInput = event.target.closest('[data-team-color]');
  const crestButton = event.target.closest('[data-crest-team]');
  if (nameInput) {
    const team = getTeam(nameInput.dataset.teamName);
    const newName = normalizeName(nameInput.value).slice(0, 28);
    if (!newName) { nameInput.value = team?.name || 'TIME'; return; }
    if (team) team.name = newName;
    persist(); renderAll();
  } else if (colorInput) {
    const team = getTeam(colorInput.dataset.teamColor);
    if (team) team.color = colorInput.value;
    persist(); renderAll();
  } else if (crestButton) {
    const team = getTeam(crestButton.dataset.crestTeam);
    if (team) team.crest = crestButton.dataset.crest;
    persist(); renderAll();
  }
}
function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function exportBackup() {
  const payload = { ...state, backupVersion: 1, exportedAt: new Date().toISOString() };
  downloadBlob('copa-colaboradores-2026-backup.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  toast('Backup exportado. Guarde o arquivo em um local seguro.');
}
function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!imported || !Array.isArray(imported.players) || !Array.isArray(imported.teams) || !Array.isArray(imported.bracket)) throw new Error('Formato inválido');
      if (!window.confirm('Importar este backup substituirá os dados atuais deste navegador. Deseja continuar?')) return;
      const base = freshState();
      state = { ...base, ...imported, settings: { ...base.settings, ...(imported.settings || {}) } };
      persist(); fillIdentityInputs(); renderAll(); toast('Backup importado com sucesso.');
    } catch (error) {
      toast('Não foi possível importar. Selecione um backup JSON válido deste campeonato.', 'error');
    }
    $('backupInput').value = '';
  };
  reader.readAsText(file, 'UTF-8');
}
function handleLogo(file) {
  if (!file) return;
  if (file.size > 1.3 * 1024 * 1024) {
    toast('A imagem tem mais de 1,3 MB. Use um logo menor para garantir que possa ser salvo no navegador.', 'warning');
    $('companyLogoInput').value = '';
    return;
  }
  if (!file.type.startsWith('image/')) {
    toast('Escolha um arquivo de imagem PNG, JPEG, WebP ou SVG.', 'warning');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.settings.companyLogo = String(reader.result);
    persist();
    updatePublishedIdentity();
    updateIdentityPreview();
    toast('Logo carregado e aplicado à identidade do campeonato.');
  };
  reader.onerror = () => toast('Não foi possível ler essa imagem.', 'error');
  reader.readAsDataURL(file);
  $('companyLogoInput').value = '';
}
function saveIdentity() {
  const eventName = normalizeName($('eventNameInput').value) || DEFAULT_SETTINGS.eventName;
  const companyName = normalizeName($('companyNameInput').value);
  state.settings.eventName = eventName;
  state.settings.companyName = companyName;
  persist();
  fillIdentityInputs();
  renderAll();
  toast('Identidade do campeonato salva em todas as telas.');
}
function updateBracketPenaltyVisibility(input) {
  if (!input || !input.dataset.score) return;
  const card = input.closest('[data-match-id]');
  const one = card?.querySelector('[data-score="one"]');
  const two = card?.querySelector('[data-score="two"]');
  const penalty = card?.querySelector('[data-penalty]');
  if (!one || !two || !penalty) return;
  const tied = one.value !== '' && two.value !== '' && Number(one.value) === Number(two.value);
  penalty.hidden = !tied;
  if (!tied) penalty.value = '';
}

// Navegação e ações principais
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.addEventListener('click', (event) => {
  const go = event.target.closest('[data-go]');
  if (go) { setView(go.dataset.go); return; }
});
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('exportTopBtn').addEventListener('click', exportBackup);
$('exportBackupBtn').addEventListener('click', exportBackup);
$('participantInput').addEventListener('input', () => {
  const parsed = parseNames($('participantInput').value);
  $('draftCounter').textContent = `${parsed.names.length} nomes`;
  $('duplicateHint').textContent = parsed.duplicates ? `${parsed.duplicates} duplicado(s) na área de texto` : '';
  const teamCount = clampNumber($('teamCount')?.value || state.settings.teamCount, 2, 16, 6);
  $('plannedDistribution').textContent = parsed.names.length ? `${Math.floor(parsed.names.length / teamCount)}–${Math.ceil(parsed.names.length / teamCount)} por time` : 'Aguardando lista';
});
$('saveParticipantsBtn').addEventListener('click', () => saveParticipantList());
$('goTeamsBtn').addEventListener('click', () => {
  if (!state.players.length || JSON.stringify(parseNames($('participantInput').value).names) !== JSON.stringify(state.players)) {
    if (!saveParticipantList()) return;
  }
  setView('teams');
});
$('participantFile').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let text = String(reader.result || '').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length > 1 && /^(nome|participante|name|colaborador)/i.test(lines[0].split(/[;,]/)[0].trim())) {
      text = lines.slice(1).map((line) => line.split(/[;,]/)[0]).join('\n');
    }
    $('participantInput').value = text;
    const parsed = parseNames(text);
    $('draftCounter').textContent = `${parsed.names.length} nomes`;
    $('duplicateHint').textContent = parsed.duplicates ? `${parsed.duplicates} duplicado(s) no arquivo` : '';
    toast(`Arquivo lido. Foram identificados ${parsed.names.length} nomes; confira e clique em “Salvar lista”.`);
  };
  reader.onerror = () => toast('Não foi possível ler o arquivo.', 'error');
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
});
$('downloadTemplateBtn').addEventListener('click', () => downloadBlob('modelo-participantes-copa-2026.csv', 'Nome\nAna Souza\nBruno Lima\nCarlos Santos\n', 'text/csv;charset=utf-8'));
$('teamCount').addEventListener('change', () => {
  state.settings.teamCount = clampNumber($('teamCount').value, 2, 16, 6); $('teamCount').value = state.settings.teamCount; persist(); renderAll();
});
$('playersPerTeam').addEventListener('change', () => {
  state.settings.playersPerTeam = clampNumber($('playersPerTeam').value, 1, 30, 5); $('playersPerTeam').value = state.settings.playersPerTeam; persist(); renderAll();
});
document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
  const input = $(button.dataset.step);
  const min = Number(input.min), max = Number(input.max);
  input.value = clampNumber(Number(input.value) + Number(button.dataset.delta), min, max, Number(input.value));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}));
$('drawTeamsBtn').addEventListener('click', makeTeams);
$('savedParticipants').addEventListener('click', (event) => {
  const field = event.target.closest('[data-player-level]');
  if (!field) return;
  const index = Number(field.dataset.playerIndex);
  const name = state.players[index];
  if (!name) return;
  const key = playerKey(name);
  const oldLevel = getPlayerLevel(name);
  const newLevel = clampNumber(field.dataset.level, 1, 5, 3);
  if (oldLevel === newLevel) return;
  if (state.teams.length) {
    const okay = window.confirm('Alterar o nível depois do sorteio pode desequilibrar as equipes. Para manter a regra, os times e os placares serão apagados e precisarão ser sorteados novamente. Continuar?');
    if (!okay) return;
    invalidateTournament();
  }
  state.playerLevels[key] = newLevel;
  persist();
  renderParticipants();
  renderTeams();
  updateCounters();
  toast(`Nível ${newLevel} · ${PLAYER_LEVELS[newLevel]} definido para ${name}.`, 'success');
});
$('teamsGrid').addEventListener('change', handleTeamChange);
$('teamsGrid').addEventListener('click', (event) => {
  const crest = event.target.closest('[data-crest-team]');
  if (crest) handleTeamChange(event);
});
$('generateBracketBtn').addEventListener('click', createBracket);
$('bracketBoard').addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-match]');
  if (editButton) { editingMatchId = editButton.dataset.editMatch; renderBracket(); return; }
  const saveButton = event.target.closest('[data-save-match]');
  if (saveButton) saveMatchResult(saveButton.dataset.saveMatch);
});
$('bracketBoard').addEventListener('input', (event) => updateBracketPenaltyVisibility(event.target));
$('printBracketBtn').addEventListener('click', () => window.print());
$('eventNameInput').addEventListener('input', updateIdentityPreview);
$('companyNameInput').addEventListener('input', updateIdentityPreview);
$('saveIdentityBtn').addEventListener('click', saveIdentity);
$('companyLogoInput').addEventListener('change', (event) => handleLogo(event.target.files?.[0]));
$('removeLogoBtn').addEventListener('click', () => {
  state.settings.companyLogo = null;
  persist();
  updatePublishedIdentity();
  updateIdentityPreview();
  toast('Logo removido da identidade do campeonato.');
});
$('backupInput').addEventListener('change', (event) => importBackup(event.target.files?.[0]));
$('resetTournamentBtn').addEventListener('click', () => {
  if (!window.confirm('Remover os times e os placares, mantendo a lista de participantes?')) return;
  invalidateTournament(); persist(); renderAll(); toast('Times e chaveamento removidos. A lista de participantes foi mantida.');
});
$('clearAllBtn').addEventListener('click', () => {
  if (!window.confirm('Isso apagará participantes, times, placares e a identidade salva neste navegador. Deseja continuar?')) return;
  state = freshState(); persist(); $('participantInput').value = ''; $('participantInput').dataset.initialized = 'true'; fillIdentityInputs(); renderAll(); setView('dashboard'); toast('Campeonato limpo. Você pode começar de novo.');
});

// Inicialização
(function init() {
  $('teamCount').value = state.settings.teamCount;
  $('playersPerTeam').value = state.settings.playersPerTeam;
  // Corrige eventuais dados antigos/incompletos e recompõe o fluxo de classificação.
  if (state.bracket.length) syncBracket();
  persist();
  fillIdentityInputs();
  renderAll();
})();
