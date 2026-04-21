<template>
  <main class="host-page">
    <section class="host-shell" aria-labelledby="host-title">
      <div class="host-panel">
        <div class="host-header">
          <div>
            <p class="eyebrow">Host</p>
            <h1 id="host-title">Host Page</h1>
            <p class="intro">Welcome to the game!</p>
            <p class="intro">Rules:</p>
              <ul class="rules-list">
                <li>
                  Use the given numbers to build an expression that gets as close as possible to the target number to score higher!
                </li>
                <li>
                  Each number can only be used once, and you must use all of the given numbers — choose wisely!
                </li>
                <li>
                  Match the target number exactly to earn a 20-point bonus!
                </li>
              </ul>
            </div>
          <button class="primary-button" @click="createRoom">Create Room</button>
        </div>
      

        <div v-if="roomCode && gamePhase === 'waiting'" class="room-banner">
          <span>Room Code</span>
          <strong>{{ roomCode }}</strong>
          <button v-if="gamePhase === 'waiting'" class="secondary-button" @click="startGame">
            Start Game
          </button>
        </div>

        <div v-if="roomCode && gamePhase === 'waiting'" class="qr-panel">
          <div class="qr-copy">
            <span>Join Link</span>
            <a :href="joinLink" target="_blank" rel="noreferrer">{{ joinLink }}</a>
          </div>
          <img :src="qrCodeUrl" alt="QR code for joining this room" />
        </div>

        <div v-if="gamePhase === 'waiting'" class="players-panel">
          <div class="section-heading">
            <h2>Players</h2>
            <span>{{ playerList.length }} joined</span>
          </div>

          <ul v-if="playerList.length" class="player-list">
            <li v-for="player in playerList" :key="player.id">
              {{ player.name }}
            </li>
          </ul>

          <p v-else class="empty-state">Waiting for players to join...</p>
        </div>

        <div v-if="gamePhase === 'playing'" class="round-panel">
          <div class="game-header">
            <div>
              <p class="eyebrow">Round {{ currentRound }} / {{ totalRounds }}</p>
              <h2>Round in Progress</h2>
            </div>
            <div class="timer-pill">Time Left: {{ timeLeft }}</div>
          </div>

          <div class="round-grid">
            <article class="stat-card">
              <span>Target</span>
              <strong>{{ target }}</strong>
            </article>

            <article class="stat-card stat-card-wide">
              <span>Numbers</span>
              <strong>{{ numbers.join(', ') }}</strong>
            </article>

            <article class="stat-card">
              <span>Submitted</span>
              <strong>{{ submittedCount }} / {{ totalPlayers }}</strong>
            </article>

            <article class="stat-card">
              <span>Operators</span>
              <strong>{{ allowDivide ? '+ - × ÷' : '+ - ×' }}</strong>
            </article>
          </div>
        </div>

        <div v-if="gamePhase === 'intermission'" class="round-panel">
          <div class="countdown-badge">Next round in {{ timeLeft }}</div>
          <div class="intermission-card">
            <div class="mechanic-icon" aria-hidden="true">{{ intermissionIcon }}</div>
            <div class="intermission-content">
              <p class="eyebrow">Next Round: {{ nextRound }} / {{ totalRounds }}</p>
              <h2>{{ intermissionTitle }}</h2>
              <div class="hint-box">
                <p v-if="intermissionIcon === '÷'">
                  Using <strong>÷</strong> can reduce large numbers and earn you a
                  <strong>10-point bonus</strong>.
                </p>
                <div v-else>
                  <p><strong>Multiply by a decimal</strong> to make a number smaller.</p>
                  <p><strong>Divide by a decimal</strong> to make it larger.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="leaderboard-panel">
            <h2>Current Leaderboard</h2>
            <ol v-if="currentLeaderboard.length" class="leaderboard-list">
              <li v-for="player in currentLeaderboard" :key="player.playerSocketId">
                <span>{{ player.name }}</span>
                <strong>{{ player.totalScore }}</strong>
              </li>
            </ol>
            <p v-else class="empty-state">No scores yet.</p>
          </div>
        </div>

        <div v-if="gamePhase === 'final'" class="round-panel">
          <div class="final-panel">
            <p class="eyebrow">Final Result</p>
            <h2>Game Complete</h2>
            <h3>Leaderboard</h3>
            <ol v-if="finalLeaderboard.length" class="leaderboard-list">
              <li v-for="player in finalLeaderboard" :key="player.playerSocketId">
                <span>{{ player.name }}</span>
                <strong>{{ player.totalScore }}</strong>
              </li>
            </ol>
            <p v-else class="empty-state">No scores yet.</p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import socket from '../socket'

const roomCode = ref('')
const playerList = ref([])
const gamePhase = ref('waiting')
const target = ref(null)
const numbers = ref([])
const timeLeft = ref(0)
const submittedCount = ref(0)
const totalPlayers = ref(0)
const topThree = ref([])
const leaderboard = ref([])
const currentRound = ref(0)
const nextRound = ref(0)
const totalRounds = ref(3)
const allowDivide = ref(false)
const intermissionTitle = ref('')
const intermissionBody = ref('')
const intermissionIcon = ref('')

let timerId = null

const currentLeaderboard = computed(() => topThree.value.slice(0, 3))
const finalLeaderboard = computed(() => leaderboard.value.slice(0, 3))

const joinLink = computed(() => {
  if (!roomCode.value) {
    return ''
  }

  return `${window.location.origin}/join?roomCode=${encodeURIComponent(roomCode.value)}`
})

const qrCodeUrl = computed(() => {
  if (!joinLink.value) {
    return ''
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinLink.value)}`
})

const createRoom = () => {
  socket.emit('create_room')
}

const startGame = () => {
  if (!roomCode.value) {
    return
  }

  socket.emit('start_game', roomCode.value)
}

const clearTimer = () => {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

const startTimer = (duration) => {
  clearTimer()
  timeLeft.value = duration

  timerId = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value -= 1
      return
    }

    clearTimer()
  }, 1000)
}

const handleRoomCreated = (data) => {
  roomCode.value = data.roomCode
}

const handlePlayerListUpdated = (players) => {
  playerList.value = Object.entries(players).map(([id, player]) => ({
    id,
    ...player
  }))

  totalPlayers.value = playerList.value.length
}

const handleRoundStarted = ({
  round,
  totalRounds: roundTotal,
  target: roundTarget,
  numbers: roundNumbers,
  duration,
  allowDivide: roundAllowDivide
}) => {
  gamePhase.value = 'playing'
  currentRound.value = round || currentRound.value + 1
  totalRounds.value = roundTotal || totalRounds.value
  allowDivide.value = Boolean(roundAllowDivide)
  target.value = roundTarget
  numbers.value = roundNumbers
  submittedCount.value = 0
  totalPlayers.value = playerList.value.length
  topThree.value = []
  startTimer(duration)
}

const handleSubmissionCountUpdated = ({ submittedCount: count, totalPlayers: total }) => {
  submittedCount.value = count
  totalPlayers.value = total
}

const handleRoundResults = ({ topThree: roundTopThree }) => {
  topThree.value = roundTopThree
}

const handleIntermissionStarted = ({
  nextRound: upcomingRound,
  totalRounds: roundTotal,
  duration,
  title,
  body,
  topThree: currentTopThree
}) => {
  gamePhase.value = 'intermission'
  nextRound.value = upcomingRound
  totalRounds.value = roundTotal || totalRounds.value
  intermissionTitle.value = title
  intermissionBody.value = body
  intermissionIcon.value = upcomingRound === 2 ? '÷' : '0.5'
  topThree.value = currentTopThree
  startTimer(duration)
}

const handleFinalResults = ({ standings, totalRounds: roundTotal }) => {
  gamePhase.value = 'final'
  totalRounds.value = roundTotal || totalRounds.value
  leaderboard.value = standings || []
  clearTimer()
}

onMounted(() => {
  socket.on('room_created', handleRoomCreated)
  socket.on('player_list_updated', handlePlayerListUpdated)
  socket.on('round_started', handleRoundStarted)
  socket.on('submission_count_updated', handleSubmissionCountUpdated)
  socket.on('round_results', handleRoundResults)
  socket.on('intermission_started', handleIntermissionStarted)
  socket.on('final_results', handleFinalResults)
})

onUnmounted(() => {
  clearTimer()
  socket.off('room_created', handleRoomCreated)
  socket.off('player_list_updated', handlePlayerListUpdated)
  socket.off('round_started', handleRoundStarted)
  socket.off('submission_count_updated', handleSubmissionCountUpdated)
  socket.off('round_results', handleRoundResults)
  socket.off('intermission_started', handleIntermissionStarted)
  socket.off('final_results', handleFinalResults)
})
</script>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  min-width: 320px;
  color: #27321d;
  background: #fff8c7;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

button {
  cursor: pointer;
  font: inherit;
}

.host-page {
  min-height: 100vh;
  padding: 32px 18px;
  background: linear-gradient(145deg, #fffef2 0%, #fff8c7 50%, #f4e98d 100%);
}

.host-shell {
  width: min(100%, 900px);
  margin: 0 auto;
}

.host-panel,
.players-panel,
.round-panel,
.leaderboard-panel {
  border: 1px solid rgba(210, 190, 71, 0.42);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 24px 60px rgba(151, 136, 36, 0.16);
}

.host-panel {
  padding: 30px;
}

.host-header,
.game-header,
.room-banner,
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.host-header {
  margin-bottom: 20px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #9a8500;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 12px;
  color: #2d3519;
  font-size: clamp(2rem, 8vw, 3rem);
  line-height: 1.05;
}

h2 {
  margin-bottom: 12px;
  color: #39431f;
  font-size: 1.2rem;
}

.intro {
  margin-bottom: 0;
  color: #687346;
  line-height: 1.6;
  font-size: clamp(1rem, 3vw, 2rem);
}

.rules-list {
  margin-top: 6px;
  margin-bottom: 0;
  padding-left: 1.4rem;
  list-style: disc; /* 這個是圓點 */
}

.rules-list li {
  color: #687346;
  line-height: 1.5;
}

.rules-list li + li {
  margin-top: 6px;
}

.primary-button,
.secondary-button {
  min-height: 46px;
  border-radius: 8px;
  padding: 0 18px;
  font-weight: 800;
  white-space: nowrap;
  transition:
    transform 150ms ease,
    box-shadow 150ms ease,
    background 150ms ease;
}

.primary-button {
  border: 0;
  color: #27321d;
  background: #f0d63b;
  box-shadow: 0 12px 24px rgba(171, 150, 24, 0.26);
}

.primary-button:hover,
.secondary-button:hover {
  transform: translateY(-1px);
}

.primary-button:hover {
  background: #e5cb2e;
}

.secondary-button {
  border: 1px solid #d5c55b;
  color: #4c571f;
  background: #fffdf0;
}

.secondary-button:hover {
  background: #fff8c7;
  box-shadow: 0 8px 18px rgba(151, 136, 36, 0.14);
}

.room-banner {
  align-items: center;
  margin-bottom: 16px;
  border: 1px solid #dccd65;
  border-radius: 8px;
  padding: 16px;
  background: #fffbe0;
}

.room-banner span,
.stat-card span,
.section-heading span {
  color: #727b39;
  font-size: 0.86rem;
  font-weight: 700;
}

.room-banner strong {
  margin-right: auto;
  color: #30391a;
  font-size: clamp(1.3rem, 5vw, 2rem);
  letter-spacing: 0;
}

.players-panel,
.round-panel,
.leaderboard-panel {
  margin-top: 16px;
  padding: 20px;
  box-shadow: none;
}

.qr-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  margin-bottom: 16px;
  border: 1px solid #dccd65;
  border-radius: 8px;
  padding: 16px;
  background: #fffdf0;
}

.qr-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.qr-copy span {
  color: #727b39;
  font-size: 0.86rem;
  font-weight: 800;
}

.qr-copy a {
  color: #43501e;
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;
  text-decoration-color: rgba(67, 80, 30, 0.35);
  text-underline-offset: 3px;
}

.qr-panel img {
  width: 132px;
  height: 132px;
  border: 1px solid #e5d97f;
  border-radius: 8px;
  padding: 8px;
  background: #ffffff;
}

.section-heading {
  align-items: center;
  margin-bottom: 14px;
}

.section-heading h2 {
  margin-bottom: 0;
}

.player-list,
.leaderboard-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.player-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.player-list li {
  min-height: 46px;
  border: 1px solid #ded16d;
  border-radius: 8px;
  padding: 12px 14px;
  color: #3d461f;
  background: #fffdf0;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.empty-state {
  margin: 0;
  border-radius: 8px;
  padding: 14px;
  color: #687346;
  background: #fffbe0;
  line-height: 1.45;
}

.game-header {
  margin-bottom: 18px;
}

.game-header h2 {
  margin-bottom: 0;
}

.intermission-card {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 18px;
  margin-top: 14px;
}

.countdown-badge {
  display: inline-flex;
  width: fit-content;
  border: 1px solid #ded16d;
  border-radius: 8px;
  padding: 6px 10px;
  color: #727b39;
  background: #fffdf0;
  font-size: 0.82rem;
  font-weight: 800;
}

.mechanic-icon {
  display: grid;
  place-items: center;
  width: clamp(82px, 18vw, 122px);
  aspect-ratio: 1;
  border: 1px solid #ded16d;
  border-radius: 50%;
  color: #4c571f;
  background: #fffbe0;
  font-size: clamp(2.5rem, 7vw, 4rem);
  font-weight: 900;
  line-height: 1;
}

.intermission-content h2 {
  margin-bottom: 0;
  font-size: clamp(1.25rem, 3vw, 1.8rem);
}

.hint-box {
  margin-top: 10px;
  border: 1px solid #ded16d;
  border-radius: 8px;
  padding: 10px 12px;
  color: #687346;
  background: #fffdf0;
  font-size: 0.94rem;
  line-height: 1.4;
}

.hint-box p {
  margin: 0;
}

.hint-box p + p {
  margin-top: 6px;
}

.hint-box strong {
  color: #4c571f;
}

.final-panel {
  display: grid;
  gap: 12px;
}

.final-panel h2 {
  margin-bottom: 0;
  font-size: clamp(1.8rem, 5vw, 2.8rem);
}

.final-panel h3 {
  margin: 0;
  color: #39431f;
  font-size: 1.15rem;
}

.timer-pill {
  flex: 0 0 auto;
  border-radius: 8px;
  padding: 12px 14px;
  color: #4d581e;
  background: #fff8c7;
  font-weight: 800;
}

.round-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  min-height: 112px;
  border: 1px solid #ded16d;
  border-radius: 8px;
  padding: 18px;
  background: #fffdf0;
}

.stat-card span {
  display: block;
  margin-bottom: 8px;
}

.stat-card strong {
  display: block;
  color: #30391a;
  font-size: clamp(1.45rem, 6vw, 2.25rem);
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.stat-card-wide {
  grid-column: span 1;
}

.leaderboard-panel h2 {
  margin-bottom: 14px;
}

.leaderboard-list {
  display: grid;
  gap: 10px;
  counter-reset: rank;
}

.leaderboard-list li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  border: 1px solid #ded16d;
  border-radius: 8px;
  padding: 10px 14px;
  color: #3d461f;
  background: #fffdf0;
  font-weight: 800;
  overflow-wrap: anywhere;
  counter-increment: rank;
}

.leaderboard-list li::before {
  content: counter(rank);
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #30391a;
  background: #f0d63b;
  font-size: 0.9rem;
}

.leaderboard-list strong {
  color: #778200;
}

@media (max-width: 720px) {
  .host-page {
    padding: 18px 12px;
  }

  .host-panel {
    padding: 22px;
  }

  .host-header,
  .game-header,
  .room-banner,
  .qr-panel,
  .intermission-card {
    display: grid;
  }

  .qr-panel {
    grid-template-columns: 1fr;
  }

  .primary-button,
  .secondary-button {
    width: 100%;
  }

  .room-banner strong {
    margin-right: 0;
  }

  .round-grid {
    grid-template-columns: 1fr;
  }
}
</style>
