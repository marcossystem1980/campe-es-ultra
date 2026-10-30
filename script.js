'use strict';

const STORAGE_KEY = 'copaColaboradores2026_v2';
const LEGACY_STORAGE_KEY = 'copaColaboradores2026_v1';
const DEFAULT_SETTINGS = {
  eventName: 'Copa dos Colaboradores 2026',
  companyName: 'Grupo Zanol & Thomaz',
  teamCount: 8,
  playersPerTeam: 5
};
const PLAYER_LEVELS = { 1: 'Iniciante', 2: 'Básico', 3: 'Intermediário', 4: 'Avançado', 5: 'Destaque' };
const NATIONS = [
  { name: 'Brasil', flag: '🇧🇷', dark: '#174c38', mid: '#2f7250' },
  { name: 'Argentina', flag: '🇦🇷', dark: '#24516b', mid: '#367f9c' },
  { name: 'Portugal', flag: '🇵🇹', dark: '#174b39', mid: '#a34c36' },
  { name: 'França', flag: '🇫🇷', dark: '#203b6b', mid: '#4c6197' },
  { name: 'Alemanha', flag: '🇩🇪', dark: '#282521', mid: '#65574a' },
  { name: 'Espanha', flag: '🇪🇸', dark: '#8d302e', mid: '#b66a36' },
  { name: 'Inglaterra', flag: '🇬🇧', dark: '#2e3b4d', mid: '#5b6a7c' },
  { name: 'Itália', flag: '🇮🇹', dark: '#20594a', mid: '#407e67' },
  { name: 'Uruguai', flag: '🇺🇾', dark: '#23618a', mid: '#5693b7' },
  { name: 'Croácia', flag: '🇭🇷', dark: '#742f3d', mid: '#a44c56' },
  { name: 'Japão', flag: '🇯🇵', dark: '#353b4d', mid: '#686e84' },
  { name: 'México', flag: '🇲🇽', dark: '#22503c', mid: '#478060' },
  { name: 'Holanda', flag: '🇳🇱', dark: '#a34e26', mid: '#cc7944' },
  { name: 'Marrocos', flag: '🇲🇦', dark: '#6b2630', mid: '#a23f43' },
  { name: 'Bélgica', flag: '🇧🇪', dark: '#433126', mid: '#80603d' },
  { name: 'Colômbia', flag: '🇨🇴', dark: '#8a5b19', mid: '#b88d31' }
];
const GROUP_LETTERS = ['A', 'B', 'C', 'D'];

function freshState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    playerLevels: {},
    teams: [],
    groups: [],
    groupMatches: [],
    playoffRounds: [],
    createdAt: null,
    completedAt: null
  };
}
let migratedFromLegacy = false;
function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeLoadedState(JSON.parse(current));
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const migrated = freshState();
      migrated.settings = { ...migrated.settings, ...(legacy.settings || {}), companyLogo: undefined };
      migrated.players = Array.isArray(legacy.players) ? legacy.players : [];
      migrated.playerLevels = legacy.playerLevels && typeof legacy.playerLevels === 'object' ? legacy.playerLevels : {};
      // A estrutura da competição mudou; antigos placares de chaveamento não são copiados.
      migrated.settings.teamCount = clampNumber(migrated.settings.teamCount, 4, 16, 8);
      migrated.settings.playersPerTeam = clampNumber(migrated.settings.playersPerTeam, 1, 30, 5);
      migratedFromLegacy = true;
      return migrated;
    }
  } catch (error) {
    console.warn('Não foi possível carregar os dados anteriores.', error);
  }
  return freshState();
}
function normalizeLoadedState(parsed) {
  const base = freshState();
  const next = { ...base, ...(parsed || {}) };
  next.settings = { ...base.settings, ...(parsed?.settings || {}) };
  delete next.settings.companyLogo;
  next.players = Array.isArray(next.players) ? next.players.map(normalizeName).filter(Boolean) : [];
  next.playerLevels = next.playerLevels && typeof next.playerLevels === 'object' ? next.playerLevels : {};
  next.teams = Array.isArray(next.teams) ? next.teams : [];
  next.groups = Array.isArray(next.groups) ? next.groups : [];
  next.groupMatches = Array.isArray(next.groupMatches) ? next.groupMatches : [];
  next.playoffRounds = Array.isArray(next.playoffRounds) ? next.playoffRounds : [];
  next.settings.teamCount = clampNumber(next.settings.teamCount, 4, 16, 8);
  next.settings.playersPerTeam = clampNumber(next.settings.playersPerTeam, 1, 30, 5);
  // Guard against a backup from the first version, whose tournament fields had a different format.
  if (!Array.isArray(next.groups) || !Array.isArray(next.groupMatches) || !Array.isArray(next.playoffRounds)) {
    next.teams = []; next.groups = []; next.groupMatches = []; next.playoffRounds = [];
  }
  return next;
}
let state = loadState();
let currentView = 'dashboard';
let selectedMatchday = 'all';
let presentationMode = false;

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const normalizeName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim();
const playerKey = (name) => normalizeName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const getTeam = (id) => state.teams.find((team) => team.id === id) || null;
const getGroup = (id) => state.groups.find((group) => group.id === id) || null;
const getGroupMatch = (id) => state.groupMatches.find((match) => match.id === id) || null;
const getKnockoutMatch = (roundIndex, matchIndex) => state.playoffRounds[roundIndex]?.matches[matchIndex] || null;
const createId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const clampNumber = (value, min, max, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
function getPlayerLevel(name) {
  const value = Number(state.playerLevels?.[playerKey(name)] || 0);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
}
function getAverageLevel(names) {
  const levels = (names || []).map(getPlayerLevel).filter(Boolean);
  return levels.length ? levels.reduce((sum, level) => sum + level, 0) / levels.length : 0;
}
function formatAverage(value) {
  return value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
}
function parseNames(raw) {
  const values = String(raw ?? '').replace(/^\uFEFF/, '').split(/[\r\n,;]+/).map(normalizeName).filter(Boolean);
  const unique = [];
  const seen = new Set();
  let duplicates = 0;
  values.forEach((name) => {
    const key = playerKey(name);
    if (seen.has(key)) { duplicates += 1; return; }
    seen.add(key); unique.push(name);
  });
  return { names: unique, duplicates, originalCount: values.length };
}
function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(error);
    toast('Não foi possível salvar no navegador. Exporte um backup e tente reduzir os dados.', 'error');
  }
}
function toast(message, type = 'success') {
  const region = $('toastRegion');
  if (!region) return;
  const item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : ''}`;
  item.textContent = message;
  while (region.children.length >= 3) region.firstElementChild.remove();
  region.appendChild(item);
  window.setTimeout(() => item.remove(), 4200);
}
function setView(view) {
  if (!['dashboard', 'participants', 'teams', 'competition', 'settings'].includes(view)) return;
  currentView = view;
  document.querySelectorAll('.view').forEach((element) => element.classList.toggle('active', element.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
  const labels = { dashboard: 'VISÃO GERAL', participants: 'PARTICIPANTES', teams: 'SELEÇÕES', competition: 'CAMPEONATO', settings: 'ORGANIZAÇÃO' };
  $('breadcrumbCurrent').textContent = labels[view] || 'CAMPEONATO';
  $('sidebar').classList.remove('open');
  if (view === 'settings') fillIdentityInputs();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Tournament structure: group stage followed by knockout. */
function groupCountForTeamCount(teamCount) {
  if (teamCount <= 5) return 1;
  if (teamCount <= 8) return 2;
  if (teamCount <= 12) return 3;
  return 4;
}
function createGroupsAndFixtures(teams) {
  const groupCount = groupCountForTeamCount(teams.length);
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: GROUP_LETTERS[index], name: `Grupo ${GROUP_LETTERS[index]}`, teamIds: []
  }));
  const shuffledTeams = shuffle(teams);
  let direction = 1;
  let targetGroup = 0;
  shuffledTeams.forEach((team) => {
    groups[targetGroup].teamIds.push(team.id);
    targetGroup += direction;
    if (targetGroup >= groupCount) { targetGroup = groupCount - 1; direction = -1; }
    else if (targetGroup < 0) { targetGroup = 0; direction = 1; }
  });
  // Circle-method schedule, so each group has real rounds and each pair meets once.
  const groupMatches = [];
  groups.forEach((group) => {
    const ids = group.teamIds.slice();
    if (ids.length < 2) return;
    if (ids.length % 2 === 1) ids.push(null);
    const cycle = ids.slice();
    const rounds = cycle.length - 1;
    for (let round = 1; round <= rounds; round += 1) {
      for (let pair = 0; pair < cycle.length / 2; pair += 1) {
        const first = cycle[pair];
        const second = cycle[cycle.length - 1 - pair];
        if (!first || !second) continue;
        groupMatches.push({
          id: createId('gm'), groupId: group.id, round,
          team1Id: first, team2Id: second,
          goals1: null, goals2: null, played: false
        });
      }
      const fixed = cycle[0];
      const remainder = cycle.slice(1);
      remainder.unshift(remainder.pop());
      cycle.splice(0, cycle.length, fixed, ...remainder);
    }
  });
  return { groups, groupMatches };
}
function blankKnockoutMatch(roundIndex, matchIndex, sources) {
  const match = {
    id: createId('ko'), roundIndex, matchIndex, sources,
    team1Id: null, team2Id: null,
    goals1: null, goals2: null, penalties1: null, penalties2: null, winnerId: null
  };
  match.team1Id = resolveSource(sources[0]);
  match.team2Id = resolveSource(sources[1]);
  return match;
}
function resolveSource(source) {
  if (!source) return null;
  if (source.kind === 'team') return source.teamId || null;
  if (source.kind === 'winner') return state.playoffRounds[source.roundIndex]?.matches[source.matchIndex]?.winnerId || null;
  return null;
}
function groupStandings(groupId) {
  const group = getGroup(groupId);
  if (!group) return [];
  const rows = group.teamIds.map((teamId) => ({
    teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
  }));
  const lookup = new Map(rows.map((row) => [row.teamId, row]));
  state.groupMatches.filter((match) => match.groupId === groupId && match.played).forEach((match) => {
    const one = lookup.get(match.team1Id);
    const two = lookup.get(match.team2Id);
    if (!one || !two) return;
    one.played += 1; two.played += 1;
    one.goalsFor += Number(match.goals1); one.goalsAgainst += Number(match.goals2);
    two.goalsFor += Number(match.goals2); two.goalsAgainst += Number(match.goals1);
    if (Number(match.goals1) > Number(match.goals2)) { one.wins += 1; two.losses += 1; one.points += 3; }
    else if (Number(match.goals1) < Number(match.goals2)) { two.wins += 1; one.losses += 1; two.points += 3; }
    else { one.draws += 1; two.draws += 1; one.points += 1; two.points += 1; }
  });
  rows.forEach((row) => { row.goalDifference = row.goalsFor - row.goalsAgainst; });
  rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || b.wins - a.wins || (getTeam(a.teamId)?.name || '').localeCompare(getTeam(b.teamId)?.name || '', 'pt-BR'));
  return rows;
}
function allGroupMatchesPlayed() {
  return state.groupMatches.length > 0 && state.groupMatches.every((match) => match.played);
}
function allGroupMatchesCount() { return state.groupMatches.filter((match) => match.played).length; }
function knockoutMatchCount() { return state.playoffRounds.reduce((sum, round) => sum + round.matches.length, 0); }
function allMatchesCount() { return state.groupMatches.length + knockoutMatchCount(); }
function allMatchesPlayedCount() { return allGroupMatchesCount() + state.playoffRounds.reduce((sum, round) => sum + round.matches.filter((match) => Boolean(match.winnerId)).length, 0); }
function getChampion() {
  if (!state.playoffRounds.length) return null;
  const final = state.playoffRounds[state.playoffRounds.length - 1];
  return final?.matches?.[0]?.winnerId || null;
}
function getQualifiedTeams() {
  const entries = [];
  state.groups.forEach((group) => {
    const standings = groupStandings(group.id);
    standings.slice(0, 2).forEach((row, index) => entries.push({ ...row, groupId: group.id, position: index + 1 }));
  });
  return entries;
}
function qualificationSeedSort(entries) {
  return entries.slice().sort((a, b) => a.position - b.position || b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || (getTeam(a.teamId)?.name || '').localeCompare(getTeam(b.teamId)?.name || '', 'pt-BR'));
}
function buildPlayoffRounds() {
  if (!allGroupMatchesPlayed()) return [];
  const teamCount = state.teams.length;
  const groups = state.groups;
  const sourceTeam = (teamId) => ({ kind: 'team', teamId });
  const sourceWinner = (roundIndex, matchIndex) => ({ kind: 'winner', roundIndex, matchIndex });
  const makeRound = (name, pairs) => ({ name, matches: pairs.map((sources, matchIndex) => blankKnockoutMatch(state.playoffRounds.length, matchIndex, sources)), complete: false });
  let rounds = [];
  if (teamCount <= 5) {
    const standings = groupStandings(groups[0].id);
    if (standings.length < 2) return [];
    rounds = [{ name: 'Grande Final', matches: [blankKnockoutMatch(0, 0, [sourceTeam(standings[0].teamId), sourceTeam(standings[1].teamId)])] }];
  } else if (teamCount <= 8) {
    const a = groupStandings('A'); const b = groupStandings('B');
    if (a.length < 2 || b.length < 2) return [];
    rounds = [
      { name: 'Semifinais', matches: [
        blankKnockoutMatch(0, 0, [sourceTeam(a[0].teamId), sourceTeam(b[1].teamId)]),
        blankKnockoutMatch(0, 1, [sourceTeam(b[0].teamId), sourceTeam(a[1].teamId)])
      ] },
      { name: 'Grande Final', matches: [
        blankKnockoutMatch(1, 0, [sourceWinner(0, 0), sourceWinner(0, 1)])
      ] }
    ];
  } else if (teamCount <= 12) {
    const seeds = qualificationSeedSort(getQualifiedTeams());
    if (seeds.length < 6) return [];
    rounds = [
      { name: 'Repescagem para a semifinal', matches: [
        blankKnockoutMatch(0, 0, [sourceTeam(seeds[2].teamId), sourceTeam(seeds[5].teamId)]),
        blankKnockoutMatch(0, 1, [sourceTeam(seeds[3].teamId), sourceTeam(seeds[4].teamId)])
      ] },
      { name: 'Semifinais', matches: [
        blankKnockoutMatch(1, 0, [sourceTeam(seeds[0].teamId), sourceWinner(0, 1)]),
        blankKnockoutMatch(1, 1, [sourceTeam(seeds[1].teamId), sourceWinner(0, 0)])
      ] },
      { name: 'Grande Final', matches: [
        blankKnockoutMatch(2, 0, [sourceWinner(1, 0), sourceWinner(1, 1)])
      ] }
    ];
  } else {
    const findPlace = (groupId, place) => groupStandings(groupId)[place - 1]?.teamId || null;
    const specs = [
      [sourceTeam(findPlace('A', 1)), sourceTeam(findPlace('B', 2))],
      [sourceTeam(findPlace('B', 1)), sourceTeam(findPlace('A', 2))],
      [sourceTeam(findPlace('C', 1)), sourceTeam(findPlace('D', 2))],
      [sourceTeam(findPlace('D', 1)), sourceTeam(findPlace('C', 2))]
    ];
    rounds = [
      { name: 'Quartas de final', matches: specs.map((sources, index) => blankKnockoutMatch(0, index, sources)) },
      { name: 'Semifinais', matches: [
        blankKnockoutMatch(1, 0, [sourceWinner(0, 0), sourceWinner(0, 1)]),
        blankKnockoutMatch(1, 1, [sourceWinner(0, 2), sourceWinner(0, 3)])
      ] },
      { name: 'Grande Final', matches: [
        blankKnockoutMatch(2, 0, [sourceWinner(1, 0), sourceWinner(1, 1)])
      ] }
    ];
  }
  return rounds;
}
function syncKnockoutRounds() {
  state.playoffRounds.forEach((round, roundIndex) => {
    round.matches.forEach((match, matchIndex) => {
      match.roundIndex = roundIndex;
      match.matchIndex = matchIndex;
      if (Array.isArray(match.sources)) {
        match.team1Id = resolveSource(match.sources[0]);
        match.team2Id = resolveSource(match.sources[1]);
      }
      if (match.winnerId && match.winnerId !== match.team1Id && match.winnerId !== match.team2Id) {
        match.winnerId = null; match.goals1 = null; match.goals2 = null; match.penalties1 = null; match.penalties2 = null;
      }
    });
    round.complete = round.matches.length > 0 && round.matches.every((match) => Boolean(match.winnerId));
  });
}
function resetKnockoutFrom(roundIndex) {
  for (let r = roundIndex + 1; r < state.playoffRounds.length; r += 1) {
    state.playoffRounds[r].matches.forEach((match) => {
      match.goals1 = null; match.goals2 = null; match.penalties1 = null; match.penalties2 = null; match.winnerId = null;
    });
  }
  syncKnockoutRounds();
}
function resetTournamentKeepPlayers() {
  state.teams = []; state.groups = []; state.groupMatches = []; state.playoffRounds = []; state.createdAt = null; state.completedAt = null; selectedMatchday = 'all';
}
function initializePlayoffs() {
  if (state.playoffRounds.length || !allGroupMatchesPlayed()) return false;
  state.playoffRounds = buildPlayoffRounds();
  if (!state.playoffRounds.length) return false;
  syncKnockoutRounds();
  persist();
  return true;
}

/* Participant management */
function renderParticipants() {
  const input = $('participantInput');
  if (input && input.dataset.initialized !== 'true') { input.value = state.players.join('\n'); input.dataset.initialized = 'true'; }
  const parsed = parseNames(input?.value || '');
  $('draftCounter').textContent = `${parsed.names.length} nomes`;
  $('participantBigCount').textContent = state.players.length;
  $('savedCounter').textContent = `${state.players.length} inscritos`;
  $('plannedTeams').textContent = String(clampNumber($('teamCount')?.value || state.settings.teamCount, 4, 16, 8));
  $('plannedStarters').textContent = String(clampNumber($('playersPerTeam')?.value || state.settings.playersPerTeam, 1, 30, 5));
  const teamCount = clampNumber($('teamCount')?.value || state.settings.teamCount, 4, 16, 8);
  $('plannedDistribution').textContent = state.players.length ? `${Math.floor(state.players.length / teamCount)}–${Math.ceil(state.players.length / teamCount)} por seleção` : 'Aguardando lista';
  $('duplicateHint').textContent = parsed.duplicates ? `${parsed.duplicates} duplicado(s) na área de texto` : '';
  const rated = state.players.filter((name) => getPlayerLevel(name) > 0).length;
  const missing = state.players.length - rated;
  const percent = state.players.length ? (rated / state.players.length) * 100 : 0;
  $('playerLevelProgress').textContent = `${rated}/${state.players.length} avaliados`;
  $('playerLevelBar').style.width = `${percent}%`;
  $('levelNotice').classList.toggle('ready', state.players.length > 0 && missing === 0);
  $('levelNotice').textContent = !state.players.length
    ? 'Salve a lista de participantes para começar a avaliação.'
    : missing
      ? `Faltam avaliar ${missing} participante(s). O sorteio fica bloqueado até todos receberem de 1 a 5 estrelas.`
      : 'Todos foram avaliados. O sorteio está liberado e poderá equilibrar os níveis entre as seleções.';
  const container = $('savedParticipants');
  if (!state.players.length) {
    container.innerHTML = '<div class="empty-inline">Nenhum participante cadastrado ainda. Importe ou cole a lista acima e clique em “Salvar lista”.</div>';
  } else {
    container.innerHTML = state.players.map((name, index) => {
      const level = getPlayerLevel(name);
      const levelLabel = level ? PLAYER_LEVELS[level] : 'Nível não definido';
      const stars = [1, 2, 3, 4, 5].map((star) => `<button type="button" class="rating-star ${star <= level ? 'is-filled' : ''} ${star === level ? 'is-selected' : ''}" data-player-level data-player-index="${index}" data-level="${star}" aria-label="${escapeHtml(name)}: definir nível ${star}, ${escapeHtml(PLAYER_LEVELS[star])}" aria-pressed="${star === level ? 'true' : 'false'}" title="${star} estrela${star > 1 ? 's' : ''} · ${escapeHtml(PLAYER_LEVELS[star])}">★</button>`).join('');
      return `<div class="rating-row ${level ? 'rated' : 'unrated'}"><span class="rating-index">${String(index + 1).padStart(2, '0')}</span><div class="rating-person"><strong>${escapeHtml(name)}</strong><small>${level ? `${level} ${level === 1 ? 'estrela' : 'estrelas'} · ${escapeHtml(levelLabel)}` : 'Clique nas estrelas para avaliar'}</small></div><div class="rating-stars" role="group" aria-label="Avaliação de ${escapeHtml(name)}">${stars}</div></div>`;
    }).join('');
  }
}
function saveParticipantList() {
  const parsed = parseNames($('participantInput').value);
  if (!parsed.names.length) { toast('Adicione pelo menos um participante antes de salvar.', 'warning'); return false; }
  const changed = JSON.stringify(parsed.names) !== JSON.stringify(state.players);
  if (changed && state.teams.length) {
    if (!window.confirm('A lista de participantes mudou. Isso apagará seleções e placares para evitar dados incorretos. Deseja continuar?')) return false;
    resetTournamentKeepPlayers();
  }
  const nextKeys = new Set(parsed.names.map(playerKey));
  const retainedLevels = {};
  Object.entries(state.playerLevels).forEach(([key, value]) => { if (nextKeys.has(key)) retainedLevels[key] = value; });
  state.playerLevels = retainedLevels;
  state.players = parsed.names;
  $('participantInput').value = state.players.join('\n');
  $('participantInput').dataset.initialized = 'true';
  persist(); renderAll();
  toast(`${state.players.length} participante(s) salvo(s). ${parsed.duplicates ? `${parsed.duplicates} duplicado(s) ignorado(s).` : 'Agora avalie cada participante.'}`);
  return true;
}

/* Team draw */
function makeTeams() {
  if (!state.players.length) { toast('Cadastre os participantes antes do sorteio.', 'warning'); setView('participants'); return; }
  const missing = state.players.filter((name) => !getPlayerLevel(name));
  if (missing.length) { toast(`Avalie os ${missing.length} participante(s) que ainda estão sem nível.`, 'warning'); setView('participants'); return; }
  const teamCount = clampNumber($('teamCount').value, 4, 16, 8);
  const starters = clampNumber($('playersPerTeam').value, 1, 30, 5);
  if (state.players.length < teamCount) { toast(`Você tem ${state.players.length} participante(s), mas selecionou ${teamCount} seleções. Reduza o número de seleções ou adicione participantes.`, 'error'); return; }
  if (state.teams.length && !window.confirm('Refazer o sorteio substituirá as seleções, a fase de grupos e todos os placares. Continuar?')) return;
  const selectedNations = shuffle(NATIONS).slice(0, teamCount);
  const teams = selectedNations.map((nation, index) => ({
    id: createId('team'), name: nation.name, flag: nation.flag, dark: nation.dark, mid: nation.mid,
    players: [], starters, seed: index + 1
  }));
  const byLevel = [5, 4, 3, 2, 1].flatMap((level) => shuffle(state.players.filter((name) => getPlayerLevel(name) === level)));
  const laneCount = teamCount * 2;
  byLevel.forEach((name, index) => {
    const position = index % laneCount;
    const teamIndex = position < teamCount ? position : laneCount - 1 - position;
    teams[teamIndex].players.push(name);
  });
  teams.forEach((team) => { team.players = team.players.slice().sort((a, b) => getPlayerLevel(b) - getPlayerLevel(a) || a.localeCompare(b, 'pt-BR')); });
  state.settings.teamCount = teamCount;
  state.settings.playersPerTeam = starters;
  selectedMatchday = 'all';
  state.teams = teams;
  const schedule = createGroupsAndFixtures(teams);
  state.groups = schedule.groups;
  state.groupMatches = schedule.groupMatches;
  state.playoffRounds = [];
  state.createdAt = new Date().toISOString();
  state.completedAt = null;
  persist(); renderAll();
  toast(`${teams.length} seleções sorteadas. A fase de grupos está pronta para começar.`);
  setView('teams');
}
function renderTeams() {
  $('teamCount').value = state.settings.teamCount;
  $('playersPerTeam').value = state.settings.playersPerTeam;
  $('teamCountBadge').textContent = `${state.teams.length} seleções`;
  $('teamsSectionTitle').textContent = state.teams.length ? 'Elencos definidos' : 'Seleções participantes';
  $('drawWarning').hidden = true;
  const grid = $('teamsGrid');
  if (!state.teams.length) {
    grid.innerHTML = '<div class="empty-state full-empty"><span class="empty-ball">⚽</span><strong>As seleções ainda não foram sorteadas</strong><p>Cadastre os participantes, avalie os níveis e clique em “Sortear seleções”.</p><button class="btn btn-outline" data-go="participants">Ir para participantes</button></div>';
    return;
  }
  grid.innerHTML = state.teams.map((team, index) => {
    const group = state.groups.find((item) => item.teamIds.includes(team.id));
    const avg = formatAverage(getAverageLevel(team.players));
    const starters = Math.min(state.settings.playersPerTeam, team.players.length);
    const roster = team.players.slice().sort((a, b) => getPlayerLevel(b) - getPlayerLevel(a) || a.localeCompare(b, 'pt-BR'));
    const rosterHtml = roster.map((name, rosterIndex) => `<div class="roster-player ${rosterIndex >= starters ? 'reserve' : ''}" title="${rosterIndex < starters ? 'Escalação inicial' : 'Reserva'}"><span class="player-number">${rosterIndex < starters ? String(rosterIndex + 1).padStart(2, '0') : 'R'}</span><span>${escapeHtml(name)}</span></div>`).join('');
    return `<article class="team-card" style="--team-dark:${team.dark};--team-mid:${team.mid}"><div class="team-card-top"><div class="team-flag" aria-label="Bandeira de ${escapeHtml(team.name)}">${team.flag}</div><div class="team-card-title"><div class="team-card-kicker">SELEÇÃO NACIONAL · ${String(index + 1).padStart(2, '0')}</div><h3>${escapeHtml(team.name)}</h3></div><span class="team-card-rank">${group ? `GRUPO ${group.id}` : 'SELEÇÃO'}</span></div><div class="team-card-stats"><div class="team-stat"><span>ELENCO</span><strong>${team.players.length}</strong></div><div class="team-stat"><span>TITULARES</span><strong>${starters}</strong></div><div class="team-stat"><span>NÍVEL MÉDIO</span><strong>${avg}</strong></div></div><div class="team-roster"><div class="roster-heading"><span>ELENCO DA SELEÇÃO</span><small>${starters} em campo · ${Math.max(0, team.players.length - starters)} reserva(s)</small></div><div class="roster-list">${rosterHtml}</div></div></article>`;
  }).join('');
}

/* Result entry and group standings */
function saveGroupResult(matchId) {
  const match = getGroupMatch(matchId);
  if (!match) return;
  const row = document.querySelector(`[data-group-match="${CSS.escape(matchId)}"]`);
  const one = row?.querySelector('[data-group-score="one"]');
  const two = row?.querySelector('[data-group-score="two"]');
  if (!one || !two || one.value === '' || two.value === '') { toast('Preencha os dois placares antes de registrar o resultado.', 'warning'); return; }
  const goals1 = clampNumber(one.value, 0, 99, -1);
  const goals2 = clampNumber(two.value, 0, 99, -1);
  if (goals1 < 0 || goals2 < 0) { toast('Use placares inteiros entre 0 e 99.', 'warning'); return; }
  const hasChanged = !match.played || match.goals1 !== goals1 || match.goals2 !== goals2;
  if (!hasChanged) { toast('Este placar já está registrado.'); return; }
  if (state.playoffRounds.length) {
    if (!window.confirm('Alterar um placar da fase de grupos pode mudar a classificação. O mata-mata e os placares eliminatórios serão reiniciados. Deseja continuar?')) return;
    state.playoffRounds = [];
  }
  match.goals1 = goals1; match.goals2 = goals2; match.played = true;
  const playoffsCreated = allGroupMatchesPlayed() && initializePlayoffs();
  persist(); renderAll();
  if (playoffsCreated) toast('Fase de grupos concluída! O mata-mata foi montado automaticamente.');
  else toast('Resultado da fase de grupos registrado.');
}
function teamLabel(teamId, emptyLabel = 'A definir') {
  const team = getTeam(teamId);
  if (!team) return `<span class="team-placeholder">${escapeHtml(emptyLabel)}</span>`;
  return `<span class="flag-mini">${team.flag}</span><span>${escapeHtml(team.name)}</span>`;
}
function renderStandingsTable(group) {
  const standings = groupStandings(group.id);
  const matchTotal = state.groupMatches.filter((match) => match.groupId === group.id).length;
  const played = state.groupMatches.filter((match) => match.groupId === group.id && match.played).length;
  const htmlRows = standings.map((row, index) => {
    const team = getTeam(row.teamId);
    const qualified = index < 2;
    return `<tr class="${qualified ? 'qualified-row' : ''}"><td>${index + 1}</td><td><span class="group-team-cell"><span class="flag-mini">${team?.flag || '⚽'}</span><span>${escapeHtml(team?.name || 'Seleção')}</span>${qualified ? '<i class="qualified-chip">CLASS.</i>' : ''}</span></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.goalsFor}</td><td>${row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td><td class="points-cell">${row.points}</td></tr>`;
  }).join('');
  return `<div class="standings-table-wrap"><table class="standings-table"><thead><tr><th>#</th><th>SELEÇÃO</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>SG</th><th>PTS</th></tr></thead><tbody>${htmlRows}</tbody></table></div><div class="group-footnote"><span>${played}/${matchTotal} jogos disputados</span><strong>2 VAGAS PARA O MATA-MATA</strong></div>`;
}
function renderGroupCards() {
  return `<div class="groups-grid">${state.groups.map((group) => {
    const total = state.groupMatches.filter((match) => match.groupId === group.id).length;
    const played = state.groupMatches.filter((match) => match.groupId === group.id && match.played).length;
    const complete = total > 0 && played === total;
    return `<article class="group-card"><div class="group-card-heading"><div class="group-title-lockup"><span class="group-letter">${group.id}</span><span><h3>Grupo ${group.id}</h3><small>${group.teamIds.length} seleções · todos contra todos</small></span></div><span class="group-status">${complete ? 'ENCERRADO' : `${played}/${total} JOGOS`}</span></div>${renderStandingsTable(group)}</article>`;
  }).join('')}</div>`;
}
function groupMatchCountPerRound() {
  return [...new Set(state.groupMatches.map((match) => match.round))].sort((a, b) => a - b);
}
function renderGroupFixtures() {
  const rounds = groupMatchCountPerRound();
  const selected = selectedMatchday === 'all' ? null : Number(selectedMatchday);
  const tabs = [`<button type="button" class="matchday-tab ${selected === null ? 'active' : ''}" data-matchday="all">Todas as rodadas</button>`, ...rounds.map((round) => `<button type="button" class="matchday-tab ${selected === round ? 'active' : ''}" data-matchday="${round}">Rodada ${round}</button>`)].join('');
  const shownRounds = selected === null ? rounds : rounds.filter((round) => round === selected);
  const body = shownRounds.map((round) => {
    const matches = state.groupMatches.filter((match) => match.round === round).sort((a, b) => a.groupId.localeCompare(b.groupId));
    if (!matches.length) return '';
    return `<div class="fixture-round-label">RODADA ${round}</div>${matches.map((match) => renderGroupFixture(match)).join('')}`;
  }).join('');
  return `<section class="panel matches-panel"><div class="panel-heading"><div><div class="eyebrow muted-eyebrow">FASE DE GRUPOS</div><h3>Calendário de partidas</h3><p>Registre cada placar. As tabelas e a classificação são atualizadas automaticamente.</p></div><span class="counter-badge">${allGroupMatchesCount()}/${state.groupMatches.length} finalizados</span></div><div class="matchday-tabs">${tabs}</div><div class="fixtures-grouped">${body || '<div class="empty-inline">Nenhum jogo nesta rodada.</div>'}</div></section>`;
}
function renderGroupFixture(match) {
  const team1 = getTeam(match.team1Id); const team2 = getTeam(match.team2Id);
  const score1 = match.goals1 == null ? '' : match.goals1;
  const score2 = match.goals2 == null ? '' : match.goals2;
  return `<div class="fixture-row ${match.played ? 'fixture-played' : ''}" data-group-match="${match.id}"><div class="fixture-row-meta">GRUPO ${match.groupId}<br />JOGO</div><div class="fixture-versus"><div class="fixture-team">${teamLabel(match.team1Id)}</div><div class="fixture-vs-line">VS</div><div class="fixture-team">${teamLabel(match.team2Id)}</div>${match.played ? '<div class="fixture-result-label">✓ RESULTADO REGISTRADO</div>' : ''}</div><div class="fixture-score-form"><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Gols de ${escapeHtml(team1?.name || 'seleção 1')}" data-group-score="one" value="${score1}" /><span class="score-separator">–</span><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Gols de ${escapeHtml(team2?.name || 'seleção 2')}" data-group-score="two" value="${score2}" /><button type="button" class="score-save-btn" data-save-group="${match.id}">${match.played ? 'Atualizar' : 'Registrar'}</button></div></div>`;
}
function renderKnockoutRound(round, roundIndex) {
  const matches = round.matches.map((match, matchIndex) => {
    const one = getTeam(match.team1Id); const two = getTeam(match.team2Id);
    const tied = match.goals1 != null && match.goals2 != null && match.goals1 === match.goals2;
    const winnerLabel = match.winnerId ? `✓ CLASSIFICADA: ${escapeHtml(getTeam(match.winnerId)?.name || 'Seleção')}` : '';
    const teamRow = (team, score, side) => `<div class="knockout-team-row ${match.winnerId === team?.id ? 'winner' : ''}">${team ? `<span class="flag-mini">${team.flag}</span><strong>${escapeHtml(team.name)}</strong>` : `<span class="flag-mini">⚑</span><strong>Aguardando classificação</strong>`}<span class="team-score-badge">${score == null ? '–' : score}</span></div>`;
    return `<article class="knockout-match ${match.winnerId ? 'is-decided' : ''}" data-knockout-match="${roundIndex}" data-knockout-index="${matchIndex}"><div class="knockout-match-label">${roundIndex === state.playoffRounds.length - 1 ? 'DECISÃO' : `CONFRONTO ${String(matchIndex + 1).padStart(2, '0')}`}</div><div class="knockout-matchup">${teamRow(one, match.goals1, 'one')}<div class="knockout-vs">VS</div>${teamRow(two, match.goals2, 'two')}</div>${one && two ? `<div class="knockout-inputs"><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Gols de ${escapeHtml(one.name)}" data-ko-score="one" value="${match.goals1 == null ? '' : match.goals1}" /><span class="score-separator">–</span><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Gols de ${escapeHtml(two.name)}" data-ko-score="two" value="${match.goals2 == null ? '' : match.goals2}" /><button type="button" class="score-save-btn" data-save-knockout="${roundIndex}:${matchIndex}">${match.winnerId ? 'Corrigir' : 'Registrar'}</button></div>` : ''}<div class="penalty-wrap" ${tied ? '' : 'hidden'}><label>Desempate por pênaltis</label><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Pênaltis de ${escapeHtml(one?.name || 'seleção 1')}" data-ko-penalty="one" value="${match.penalties1 == null ? '' : match.penalties1}" /><span>–</span><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Pênaltis de ${escapeHtml(two?.name || 'seleção 2')}" data-ko-penalty="two" value="${match.penalties2 == null ? '' : match.penalties2}" /><span class="penalty-help">Se o jogo empatar, preencha os pênaltis e registre novamente.</span></div>${winnerLabel ? `<div class="knockout-winner-badge">${winnerLabel}</div>` : ''}</article>`;
  }).join('');
  const completed = round.matches.filter((match) => Boolean(match.winnerId)).length;
  return `<section class="knockout-round"><div class="knockout-round-header"><strong>${escapeHtml(round.name)}</strong><span>${completed}/${round.matches.length} DECIDIDOS</span></div><div class="knockout-matches">${matches}</div></section>`;
}
function renderPlayoffs() {
  if (!state.playoffRounds.length) {
    const completed = allGroupMatchesPlayed();
    return `<section class="panel knockout-section"><div class="panel-heading"><div><div class="eyebrow muted-eyebrow">ELIMINATÓRIAS</div><h3>${completed ? 'Classificados definidos' : 'Caminho até a final'}</h3><p>${completed ? 'A fase de grupos terminou. O mata-mata será montado automaticamente.' : 'As duas melhores seleções de cada grupo avançam quando todos os jogos da fase de grupos tiverem resultado.'}</p></div><span class="counter-badge">${completed ? 'PRONTO PARA AVANÇAR' : 'AGUARDANDO GRUPOS'}</span></div>${completed ? '<div class="empty-inline">Atualize o campeonato para montar o mata-mata.</div>' : '<div class="empty-inline">A classificação decide os confrontos eliminatórios. Empates no mata-mata serão resolvidos nos pênaltis.</div>'}<div class="form-actions" style="padding:0 20px 18px;margin-top:0"><button type="button" class="btn btn-brass" id="createPlayoffsBtn" ${completed ? '' : 'disabled'}>✦ Montar mata-mata</button></div></section>`;
  }
  return `<section class="knockout-section"><div class="knockout-heading"><div><div class="eyebrow muted-eyebrow">A DECISÃO COMEÇA AQUI</div><h2>Fase eliminatória</h2><p>Resultado empatado? Registre a disputa de pênaltis para definir quem avança.</p></div><span class="counter-badge">${state.playoffRounds.flatMap((round) => round.matches).filter((match) => match.winnerId).length}/${knockoutMatchCount()} jogos decididos</span></div>${state.playoffRounds.map((round, index) => renderKnockoutRound(round, index)).join('')}</section>`;
}
function renderCompetition() {
  const intro = $('competitionIntro'); const workspace = $('competitionWorkspace'); const banner = $('championBanner');
  if (!state.teams.length || !state.groups.length || !state.groupMatches.length) {
    intro.hidden = false; banner.hidden = true;
    workspace.innerHTML = '<div class="empty-state full-empty"><span class="empty-ball">⚽</span><strong>O primeiro apito ainda vai acontecer</strong><p>Monte os elencos na aba Seleções para gerar a tabela da competição.</p><button class="btn btn-outline" data-go="teams">Preparar seleções</button></div>';
    return;
  }
  intro.hidden = true;
  const groupDone = allGroupMatchesPlayed();
  const groupsDone = state.groups.length;
  const groupLabel = `${groupsDone} ${groupsDone === 1 ? 'grupo' : 'grupos'} · ${state.teams.length} seleções · ${state.groupMatches.length} jogos na primeira fase`;
  const phaseTitle = state.playoffRounds.length ? (getChampion() ? 'Campeonato concluído' : 'Mata-mata em andamento') : (groupDone ? 'Fase de grupos encerrada' : 'Fase de grupos');
  const phaseDescription = state.playoffRounds.length ? (getChampion() ? 'A taça já tem dona. Confira o resultado da grande final.' : 'As classificadas disputam vagas rodada a rodada até a final.') : (groupDone ? 'Todos os resultados foram registrados. Confirme a classificação e monte as eliminatórias.' : 'Cada seleção enfrenta as demais equipes do grupo. Vitória vale 3 pontos e empate vale 1 ponto para cada lado.');
  const progressPill = getChampion() ? 'CAMPEÃO DEFINIDO' : state.playoffRounds.length ? 'MATA-MATA' : groupDone ? 'CLASSIFICADOS DEFINIDOS' : 'FASE DE GRUPOS';
  const groupsHtml = `<div class="format-banner"><span class="format-banner-icon">▤</span><div class="format-banner-copy"><strong>${phaseTitle}</strong><p>${groupLabel}. ${phaseDescription}</p></div><span class="format-banner-pill">${progressPill}</span></div>`;
  const playoffHtml = renderPlayoffs();
  workspace.innerHTML = `${groupsHtml}${renderGroupCards()}${renderGroupFixtures()}${playoffHtml}`;
  const championId = getChampion();
  banner.hidden = !championId;
  if (championId) $('championNameBanner').textContent = `${getTeam(championId)?.flag || ''} ${getTeam(championId)?.name || 'Seleção campeã'}`;
}

/* Overview, counters and identity */
function renderMiniMatch(match, type) {
  const one = getTeam(match.team1Id); const two = getTeam(match.team2Id);
  const label = type === 'group' ? `GRUPO ${match.groupId}` : (state.playoffRounds[match.roundIndex]?.name || 'MATA-MATA');
  const date = type === 'group' ? `RODADA ${match.round}` : `JOGO ${match.matchIndex + 1}`;
  const score = match.goals1 != null && match.goals2 != null ? `${match.goals1} – ${match.goals2}` : 'A JOGAR';
  return `<div class="next-match-row"><div class="next-match-meta">${escapeHtml(label)}<br />${escapeHtml(date)}</div><div class="next-match-teams"><div class="next-team"><span class="flag-mini">${one?.flag || '⚑'}</span><span>${escapeHtml(one?.name || 'A definir')}</span></div><div class="next-team"><span class="flag-mini">${two?.flag || '⚑'}</span><span>${escapeHtml(two?.name || 'A definir')}</span></div></div><div class="next-score ${match.winnerId || match.played ? '' : 'pending'}">${score}</div></div>`;
}
function renderNextMatches() {
  const container = $('nextMatches');
  let matches = [];
  if (state.teams.length && !allGroupMatchesPlayed()) {
    matches = state.groupMatches.filter((match) => !match.played).slice(0, 4).map((match) => ({ match, type: 'group' }));
    $('nextMatchesSubtitle').textContent = 'Jogos pendentes da fase de grupos.';
  } else if (state.playoffRounds.length) {
    const knockout = state.playoffRounds.flatMap((round, roundIndex) => round.matches.map((match, matchIndex) => ({ ...match, roundIndex, matchIndex }))).filter((match) => match.team1Id && match.team2Id && !match.winnerId);
    matches = knockout.slice(0, 4).map((match) => ({ match, type: 'knockout' }));
    $('nextMatchesSubtitle').textContent = getChampion() ? 'A grande final definiu a seleção campeã.' : 'Próximas partidas decisivas da fase eliminatória.';
  } else if (state.teams.length && allGroupMatchesPlayed()) {
    $('nextMatchesSubtitle').textContent = 'Fase de grupos encerrada; o mata-mata está pronto para ser montado.';
  } else {
    $('nextMatchesSubtitle').textContent = 'Os próximos confrontos aparecem aqui após o sorteio.';
  }
  if (!matches.length) {
    if (getChampion()) {
      container.innerHTML = `<div class="empty-state compact-empty"><span>🏆</span><strong>Campeonato encerrado</strong><p>${escapeHtml(getTeam(getChampion())?.name || 'A seleção campeã')} levantou a taça.</p><button class="btn btn-small btn-outline" data-go="competition">Ver campeão</button></div>`;
    } else if (state.teams.length && allGroupMatchesPlayed()) {
      container.innerHTML = '<div class="empty-state compact-empty"><span class="empty-ball">🏆</span><strong>Classificação concluída</strong><p>Confira as tabelas e monte a fase eliminatória.</p><button class="btn btn-small btn-outline" data-go="competition">Abrir campeonato</button></div>';
    } else {
      container.innerHTML = '<div class="empty-state compact-empty"><span class="empty-ball">⚽</span><strong>O estádio está pronto</strong><p>Cadastre os participantes e forme as seleções para organizar a competição.</p><button class="btn btn-small btn-outline" data-go="participants">Começar agora</button></div>';
    }
    return;
  }
  container.innerHTML = matches.map(({ match, type }) => renderMiniMatch(match, type)).join('');
}
function renderDashboardStandings() {
  const target = $('dashboardStandings');
  if (!state.groups.length) {
    target.innerHTML = '<div class="standings-empty">A classificação aparecerá depois que as seleções e os grupos forem definidos.</div>';
    return;
  }
  target.innerHTML = `<div class="groups-grid">${state.groups.map((group) => {
    const standings = groupStandings(group.id);
    return `<div class="dashboard-table-wrap"><table class="dashboard-table"><thead><tr><th colspan="2">GRUPO ${group.id}</th><th>J</th><th>SG</th><th>PTS</th></tr></thead><tbody>${standings.map((row, index) => {
      const team = getTeam(row.teamId);
      return `<tr><td class="table-position ${index < 2 ? 'qualified' : ''}">${index + 1}</td><td class="team-name-cell"><span class="group-team-cell"><span class="flag-mini">${team?.flag || '⚑'}</span><span>${escapeHtml(team?.name || 'Seleção')}</span></span></td><td>${row.played}</td><td>${row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td><td><strong>${row.points}</strong></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }).join('')}</div>`;
}
function updateCounters() {
  const played = allMatchesPlayedCount(); const total = allMatchesCount(); const teams = state.teams.length; const champion = getChampion();
  $('statParticipants').textContent = String(state.players.length);
  $('statParticipantsNote').textContent = `${state.players.filter((name) => getPlayerLevel(name)).length} níveis avaliados`;
  $('statTeams').textContent = String(teams);
  $('statTeamsNote').textContent = teams ? `${teams} seleções formadas` : 'Aguardando sorteio';
  $('statPlayed').innerHTML = `${played}<span class="stat-total" id="statTotal"> / ${total}</span>`;
  $('statPhaseNote').textContent = champion ? 'Todos os jogos decisivos concluídos' : state.playoffRounds.length ? 'Disputa eliminatória' : state.teams.length ? `${allGroupMatchesCount()} de ${state.groupMatches.length} jogos de grupos` : 'A bola ainda não rolou';
  $('statChampion').textContent = champion ? (getTeam(champion)?.name || 'Campeão') : 'EM ABERTO';
  $('championNote').textContent = champion ? 'A taça tem dona!' : 'A próxima história será escrita em campo';
  $('participantProgress').style.width = `${Math.min(100, state.players.length / 48 * 100)}%`;
  $('teamProgress').style.width = `${teams ? 100 : 0}%`;
  $('matchProgress').style.width = `${total ? played / total * 100 : 0}%`;
  $('navParticipantCount').textContent = String(state.players.length);
  $('eventStatus').textContent = champion ? 'CAMPEÃO DEFINIDO' : state.playoffRounds.length ? 'MATA-MATA' : state.teams.length ? (allGroupMatchesPlayed() ? 'GRUPOS ENCERRADOS' : 'EM DISPUTA') : state.players.length ? 'INSCRIÇÕES ABERTAS' : 'PRÉ-TEMPORADA';
  $('stepPlayersState').textContent = state.players.length && state.players.every((name) => getPlayerLevel(name)) ? 'CONCLUÍDO' : state.players.length ? 'EM ANDAMENTO' : 'PENDENTE';
  $('stepTeamsState').textContent = teams ? 'CONCLUÍDO' : 'PENDENTE';
  $('stepGroupsState').textContent = state.teams.length ? (allGroupMatchesPlayed() ? 'CONCLUÍDO' : 'EM ANDAMENTO') : 'PENDENTE';
  $('stepFinalState').textContent = champion ? 'CONCLUÍDO' : state.playoffRounds.length ? 'EM ANDAMENTO' : 'PENDENTE';
  ['stepPlayersState', 'stepTeamsState', 'stepGroupsState', 'stepFinalState'].forEach((id) => $(id).classList.toggle('done', $(''+id).textContent === 'CONCLUÍDO'));
  $('journeyFooterText').textContent = champion ? `${getTeam(champion)?.name || 'A campeã'} conquistou a Copa` : state.playoffRounds.length ? 'A disputa pelo título está em andamento' : state.teams.length ? 'A fase de grupos define quem segue na competição' : 'Preparação do campeonato em andamento';
}
function updatePublishedIdentity() {
  const eventName = normalizeName(state.settings.eventName) || DEFAULT_SETTINGS.eventName;
  const companyName = normalizeName(state.settings.companyName) || DEFAULT_SETTINGS.companyName;
  const uppercaseEvent = eventName.toLocaleUpperCase('pt-BR');
  document.title = `${eventName} | ${companyName}`;
  ['topbarEventName', 'footerEventName', 'previewEventName'].forEach((id) => { if ($(id)) $(id).textContent = uppercaseEvent; });
  ['topbarCompanyName', 'previewCompanyName'].forEach((id) => { if ($(id)) $(id).textContent = companyName.toLocaleUpperCase('pt-BR'); });
  if (eventName.toLocaleLowerCase('pt-BR') === DEFAULT_SETTINGS.eventName.toLocaleLowerCase('pt-BR')) {
    $('heroEventName').innerHTML = 'COPA DOS<br /><span>COLABORADORES</span> <b>2026</b>';
  } else {
    $('heroEventName').textContent = uppercaseEvent;
  }
  $('heroCompanyLine').textContent = companyName ? `${companyName} · Talento em campo. União em cada jogada.` : 'Talento em campo. União em cada jogada.';
}
function fillIdentityInputs() {
  $('eventNameInput').value = state.settings.eventName || DEFAULT_SETTINGS.eventName;
  $('companyNameInput').value = state.settings.companyName || DEFAULT_SETTINGS.companyName;
  updateIdentityPreview();
}
function updateIdentityPreview() {
  $('previewEventName').textContent = normalizeName($('eventNameInput').value || DEFAULT_SETTINGS.eventName).toLocaleUpperCase('pt-BR');
  $('previewCompanyName').textContent = normalizeName($('companyNameInput').value || DEFAULT_SETTINGS.companyName).toLocaleUpperCase('pt-BR');
}
function renderAll() {
  renderParticipants(); renderTeams(); renderCompetition(); renderNextMatches(); renderDashboardStandings(); updateCounters(); updatePublishedIdentity();
}

/* Backup management */
function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function exportBackup() {
  const payload = { ...state, backupVersion: 2, exportedAt: new Date().toISOString() };
  downloadBlob('copa-colaboradores-2026-backup.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  toast('Backup exportado. Guarde o arquivo em um local seguro.');
}
function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!imported || !Array.isArray(imported.players) || !imported.settings) throw new Error('Formato inválido');
      if (!window.confirm('Importar este backup substituirá os dados atuais deste navegador. Deseja continuar?')) return;
      state = normalizeLoadedState(imported);
      // If a backup was created with the earlier knockout-only version, start its tournament again safely.
      if (imported.backupVersion !== 2 || !Array.isArray(imported.groups) || !Array.isArray(imported.groupMatches)) resetTournamentKeepPlayers();
      persist(); fillIdentityInputs(); renderAll(); toast('Backup importado com sucesso.');
    } catch (error) {
      toast('Não foi possível importar. Selecione um backup JSON válido da Copa.', 'error');
    }
    $('backupInput').value = '';
  };
  reader.onerror = () => toast('Não foi possível ler o arquivo.', 'error');
  reader.readAsText(file, 'UTF-8');
}
function saveIdentity() {
  state.settings.eventName = normalizeName($('eventNameInput').value) || DEFAULT_SETTINGS.eventName;
  state.settings.companyName = normalizeName($('companyNameInput').value) || DEFAULT_SETTINGS.companyName;
  persist(); fillIdentityInputs(); renderAll(); toast('Identidade atualizada no menu, cabeçalho e painel principal.');
}
function togglePresentationMode() {
  presentationMode = !presentationMode;
  document.body.classList.toggle('presentation-mode', presentationMode);
  $('presentationModeBtn').innerHTML = presentationMode ? '× <span>Sair do telão</span>' : '▣ <span>Modo telão</span>';
  $('presentationModeBtn').title = presentationMode ? 'Sair do modo telão' : 'Ativar modo telão';
  if (presentationMode && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (!presentationMode && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

/* Event binding */
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.addEventListener('click', (event) => {
  const go = event.target.closest('[data-go]');
  if (go) { event.preventDefault(); setView(go.dataset.go); return; }
  const saveGroup = event.target.closest('[data-save-group]');
  if (saveGroup) { saveGroupResult(saveGroup.dataset.saveGroup); return; }
  const saveKo = event.target.closest('[data-save-knockout]');
  if (saveKo) {
    const [round, match] = saveKo.dataset.saveKnockout.split(':').map(Number);
    saveKnockoutResult(round, match); return;
  }
  const day = event.target.closest('[data-matchday]');
  if (day) { selectedMatchday = day.dataset.matchday; renderCompetition(); return; }
  if (event.target.closest('#createPlayoffsBtn')) {
    if (!allGroupMatchesPlayed()) { toast('Registre todos os resultados da fase de grupos antes de montar o mata-mata.', 'warning'); return; }
    if (initializePlayoffs()) { renderAll(); toast('Mata-mata criado conforme a classificação dos grupos.'); }
    else toast('Não foi possível criar as eliminatórias. Confira o número de seleções e os grupos.', 'error');
    return;
  }
});
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('exportTopBtn').addEventListener('click', exportBackup);
$('exportBackupBtn').addEventListener('click', exportBackup);
$('presentationModeBtn').addEventListener('click', togglePresentationMode);
$('participantInput').addEventListener('input', () => {
  const parsed = parseNames($('participantInput').value);
  $('draftCounter').textContent = `${parsed.names.length} nomes`;
  $('duplicateHint').textContent = parsed.duplicates ? `${parsed.duplicates} duplicado(s) na área de texto` : '';
  const teamCount = clampNumber($('teamCount')?.value || state.settings.teamCount, 4, 16, 8);
  $('plannedDistribution').textContent = parsed.names.length ? `${Math.floor(parsed.names.length / teamCount)}–${Math.ceil(parsed.names.length / teamCount)} por seleção` : 'Aguardando lista';
});
$('saveParticipantsBtn').addEventListener('click', () => saveParticipantList());
$('goTeamsBtn').addEventListener('click', () => {
  if (!state.players.length || JSON.stringify(parseNames($('participantInput').value).names) !== JSON.stringify(state.players)) {
    if (!saveParticipantList()) return;
  }
  setView('teams');
});
$('participantFile').addEventListener('change', (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let text = String(reader.result || '').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length > 1 && /^(nome|participante|name|colaborador)/i.test(lines[0].split(/[;,]/)[0].trim())) {
      text = lines.slice(1).map((line) => line.split(/[;,]/)[0]).join('\n');
    }
    $('participantInput').value = text; $('participantInput').dispatchEvent(new Event('input', { bubbles: true }));
    const parsed = parseNames(text);
    toast(`Arquivo lido. Identificamos ${parsed.names.length} nomes; confira e clique em “Salvar lista”.`);
  };
  reader.onerror = () => toast('Não foi possível ler esse arquivo.', 'error');
  reader.readAsText(file, 'UTF-8'); event.target.value = '';
});
$('downloadTemplateBtn').addEventListener('click', () => downloadBlob('modelo-participantes-copa-2026.csv', 'Nome\nAna Souza\nBruno Lima\nCarlos Santos\n', 'text/csv;charset=utf-8'));
$('teamCount').addEventListener('change', () => {
  const next = clampNumber($('teamCount').value, 4, 16, 8);
  if (state.teams.length && next !== state.settings.teamCount) {
    if (!window.confirm('Alterar a quantidade de seleções exige um novo sorteio e apagará os placares. Continuar?')) { $('teamCount').value = state.settings.teamCount; return; }
    resetTournamentKeepPlayers();
  }
  state.settings.teamCount = next; $('teamCount').value = next; persist(); renderAll();
});
$('playersPerTeam').addEventListener('change', () => {
  const next = clampNumber($('playersPerTeam').value, 1, 30, 5);
  if (state.teams.length && next !== state.settings.playersPerTeam) {
    if (!window.confirm('Alterar os titulares modifica a escalação. Deseja manter os elencos e atualizar a quantidade em campo?')) { $('playersPerTeam').value = state.settings.playersPerTeam; return; }
  }
  state.settings.playersPerTeam = next; $('playersPerTeam').value = next; persist(); renderAll();
});
document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
  const input = $(button.dataset.step); const next = clampNumber(Number(input.value) + Number(button.dataset.delta), Number(input.min), Number(input.max), Number(input.value));
  input.value = next; input.dispatchEvent(new Event('change', { bubbles: true }));
}));
$('drawTeamsBtn').addEventListener('click', makeTeams);
$('savedParticipants').addEventListener('click', (event) => {
  const button = event.target.closest('[data-player-level]'); if (!button) return;
  const index = Number(button.dataset.playerIndex); const name = state.players[index]; if (!name) return;
  const oldLevel = getPlayerLevel(name); const newLevel = clampNumber(button.dataset.level, 1, 5, 3);
  if (oldLevel === newLevel) return;
  if (state.teams.length) {
    if (!window.confirm('Alterar o nível depois do sorteio invalida o equilíbrio das seleções e apaga os placares. Deseja continuar?')) return;
    resetTournamentKeepPlayers();
  }
  state.playerLevels[playerKey(name)] = newLevel; persist(); renderAll();
  toast(`Nível ${newLevel} · ${PLAYER_LEVELS[newLevel]} definido para ${name}.`);
});
$('refreshCompetitionBtn').addEventListener('click', () => { renderCompetition(); toast('Tabelas e confrontos atualizados.'); });
$('printCompetitionBtn').addEventListener('click', () => { setView('competition'); window.setTimeout(() => window.print(), 80); });
$('eventNameInput').addEventListener('input', updateIdentityPreview);
$('companyNameInput').addEventListener('input', updateIdentityPreview);
$('saveIdentityBtn').addEventListener('click', saveIdentity);
$('backupInput').addEventListener('change', (event) => importBackup(event.target.files?.[0]));
$('resetTournamentBtn').addEventListener('click', () => {
  if (!window.confirm('Remover as seleções e todos os placares, mantendo os inscritos e as avaliações?')) return;
  resetTournamentKeepPlayers(); persist(); renderAll(); toast('Sorteio e jogos removidos. A lista de participantes foi mantida.');
});
$('clearAllBtn').addEventListener('click', () => {
  if (!window.confirm('Isso apagará participantes, avaliações, seleções, placares e identidade deste navegador. Deseja continuar?')) return;
  state = freshState(); persist(); $('participantInput').value = ''; $('participantInput').dataset.initialized = 'true'; fillIdentityInputs(); renderAll(); setView('dashboard'); toast('Campeonato limpo. Você pode começar de novo.');
});
$('competitionWorkspace').addEventListener('input', (event) => {
  const field = event.target.closest('[data-ko-score]');
  if (!field) return;
  const card = field.closest('[data-knockout-match]');
  const one = card?.querySelector('[data-ko-score="one"]'); const two = card?.querySelector('[data-ko-score="two"]');
  const penalty = card?.querySelector('.penalty-wrap');
  if (penalty) penalty.hidden = !(one?.value !== '' && two?.value !== '' && Number(one.value) === Number(two.value));
});

function saveKnockoutResult(roundIndex, matchIndex) {
  const match = getKnockoutMatch(roundIndex, matchIndex);
  if (!match) return;
  if (!match.team1Id || !match.team2Id) { toast('Aguardando as seleções classificadas para este confronto.', 'warning'); return; }
  const card = document.querySelector(`[data-knockout-match="${roundIndex}"][data-knockout-index="${matchIndex}"]`);
  const one = card?.querySelector('[data-ko-score="one"]'); const two = card?.querySelector('[data-ko-score="two"]');
  if (!one || !two || one.value === '' || two.value === '') { toast('Preencha os dois placares para registrar a partida.', 'warning'); return; }
  const goals1 = clampNumber(one.value, 0, 99, -1); const goals2 = clampNumber(two.value, 0, 99, -1);
  if (goals1 < 0 || goals2 < 0) { toast('Use placares inteiros entre 0 e 99.', 'warning'); return; }
  let winnerId = null; let penalties1 = null; let penalties2 = null;
  if (goals1 > goals2) winnerId = match.team1Id;
  else if (goals2 > goals1) winnerId = match.team2Id;
  else {
    const pen1 = card?.querySelector('[data-ko-penalty="one"]'); const pen2 = card?.querySelector('[data-ko-penalty="two"]');
    if (!pen1 || !pen2 || pen1.value === '' || pen2.value === '') { toast('O jogo terminou empatado. Preencha os placares dos pênaltis para decidir quem avança.', 'warning'); card?.querySelector('.penalty-wrap')?.removeAttribute('hidden'); return; }
    penalties1 = clampNumber(pen1.value, 0, 99, -1); penalties2 = clampNumber(pen2.value, 0, 99, -1);
    if (penalties1 < 0 || penalties2 < 0 || penalties1 === penalties2) { toast('Os pênaltis precisam ter placares válidos e um vencedor.', 'warning'); return; }
    winnerId = penalties1 > penalties2 ? match.team1Id : match.team2Id;
  }
  const changed = match.goals1 !== goals1 || match.goals2 !== goals2 || match.winnerId !== winnerId || match.penalties1 !== penalties1 || match.penalties2 !== penalties2;
  if (!changed) { toast('Este resultado já está registrado.'); return; }
  const downstreamHasResults = state.playoffRounds.slice(roundIndex + 1).some((round) => round.matches.some((item) => item.winnerId));
  if (downstreamHasResults && !window.confirm('Alterar este resultado pode mudar os confrontos seguintes. Os placares das próximas fases serão reiniciados. Continuar?')) return;
  match.goals1 = goals1; match.goals2 = goals2; match.penalties1 = penalties1; match.penalties2 = penalties2; match.winnerId = winnerId;
  resetKnockoutFrom(roundIndex);
  syncKnockoutRounds();
  if (getChampion()) state.completedAt = new Date().toISOString(); else state.completedAt = null;
  persist(); renderAll();
  toast(`${getTeam(winnerId)?.name || 'Seleção'} classificada para a próxima fase.`);
}

// Initialization
(function init() {
  $('teamCount').value = state.settings.teamCount;
  $('playersPerTeam').value = state.settings.playersPerTeam;
  // Restore older tournament data only when it matches the current group format.
  if (state.playoffRounds.length) syncKnockoutRounds();
  persist(); fillIdentityInputs(); renderAll();
  if (migratedFromLegacy) toast('Dados anteriores encontrados. Participantes e avaliações foram preservados; o novo formato exige refazer o sorteio.', 'warning');
})();
