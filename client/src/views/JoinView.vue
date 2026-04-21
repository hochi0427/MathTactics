<template>
  <main class="join-page">
    <div v-if="!hasJoined" class="join-shell">
      <section class="join-panel" aria-labelledby="join-title">
        <p class="eyebrow">Student</p>
        <h1 id="join-title">Join Game</h1>
        <p class="intro">Enter your name and room code to join the round.</p>

        <div class="join-form">
          <label>
            <span>Your Name</span>
            <input v-model="name" placeholder="Your Name" />
          </label>

          <label>
            <span>Room Code</span>
            <input v-model="roomCode" placeholder="Room Code" />
          </label>

          <button class="primary-button" @click="joinRoom">Join</button>
        </div>

        <p v-if="message" class="message">{{ message }}</p>
      </section>
    </div>

    <section v-else-if="showTutorial" class="tutorial-shell" aria-labelledby="tutorial-title">
      <div class="tutorial-header">
        <div>
          <p class="eyebrow">Practice</p>
          <h1 id="tutorial-title">Tutorial</h1>
        </div>
        <button class="secondary-button skip-button" @click="completeTutorial">Skip</button>
      </div>

      <div class="tutorial-copy">
        <p>Build an expression using the given numbers.</p>
        <p>Try to get as close as possible to the target number.</p>
        <p>Each number can only be used once, and you must use all numbers.</p>
      </div>

      <div class="round-grid">
        <article class="stat-card">
          <span>Target</span>
          <strong>{{ tutorialTarget }}</strong>
        </article>

        <article class="stat-card stat-card-wide">
          <span>Numbers</span>
          <strong>{{ tutorialNumbers.join(', ') }}</strong>
        </article>
      </div>

      <div class="expression-panel">
        <h2>Expression</h2>
        <p class="expression-display">{{ formatExpression(tutorialExpression) || 'No expression yet' }}</p>
        <p v-if="tutorialResult" class="calculation-result">= {{ tutorialResult }}</p>
      </div>

      <div class="button-grid number-grid" aria-label="Tutorial numbers">
        <button
          v-for="number in tutorialNumbers"
          :key="number"
          class="choice-button"
          @click="appendToTutorialExpression(String(number))"
        >
          {{ number }}
        </button>
      </div>

      <div class="button-grid operator-grid tutorial-operator-grid" aria-label="Tutorial operators">
        <template v-for="operator in tutorialOperators" :key="operator">
          <button
            v-if="operator !== '/' || !isTutorial"
            class="choice-button operator-button"
            @click="operator === '=' ? calculateTutorialResult() : appendToTutorialExpression(operator)"
          >
            {{ getOperatorLabel(operator) }}
          </button>
        </template>
      </div>

      <div class="action-row">
        <button class="secondary-button" @click="deleteLastTutorialCharacter">Delete</button>
        <button class="secondary-button" @click="clearTutorialExpression">Clear</button>
        <button class="primary-button" @click="completeTutorial">Submit</button>
      </div>
    </section>

    <section
      v-else-if="hasJoined && !showTutorial && gamePhase === 'waiting'"
      class="waiting-shell"
      aria-labelledby="waiting-title"
    >
      <p class="eyebrow">Waiting</p>
      <h1 id="waiting-title">Waiting for the round to start</h1>
      <p class="intro">You joined the room. The game will begin when the host starts the round.</p>
      <p v-if="message" class="message">{{ message }}</p>
    </section>

    <section v-else-if="gamePhase === 'playing'" class="game-shell" aria-labelledby="game-title">
      <div class="game-header">
        <div>
          <p class="eyebrow">Round {{ currentRound }} / {{ totalRounds }}</p>
          <h1 id="game-title">Game Started</h1>
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
      </div>

      <div class="expression-panel">
        <h2>Expression</h2>
        <p class="expression-display">{{ formatExpression(expression) || 'No expression yet' }}</p>
        <p v-if="calculationResult" class="calculation-result">= {{ calculationResult }}</p>
      </div>

      <div class="button-grid number-grid" aria-label="Numbers">
        <button
          v-for="(number, index) in numbers"
          :key="`${number}-${index}`"
          class="choice-button"
          @click="appendToExpression(String(number))"
        >
          {{ number }}
        </button>
      </div>

      <div class="button-grid operator-grid" aria-label="Operators">
        <template v-for="operator in operators" :key="operator">
          <button
            v-if="operator !== '/' || allowDivide"
            class="choice-button operator-button"
            @click="operator === '=' ? calculateResult() : appendToExpression(operator)"
          >
            {{ getOperatorLabel(operator) }}
          </button>
        </template>
      </div>

      <div class="action-row">
        <button class="secondary-button" @click="deleteLastCharacter">Delete</button>
        <button class="secondary-button" @click="clearExpression">Clear</button>
        <button class="primary-button" @click="submitAnswer">Submit</button>
      </div>

      <div v-if="personalResult" class="result-panel">
        <h2>Your Result</h2>
        <p>Your expression: {{ formatExpression(personalResult.expression) || '(no submission)' }}</p>
        <p>Rounded result: {{ personalResult.roundedResult }}</p>
        <p>Status: {{ personalResult.isValid ? 'Valid' : 'Invalid' }}</p>
        <p>Round score: {{ personalResult.roundScore }}</p>
        <p>Total score: {{ personalResult.totalScore }}</p>
      </div>
    </section>

    <section v-else-if="gamePhase === 'intermission'" class="game-shell" aria-labelledby="intermission-title">
      <div class="countdown-badge">Next round in {{ timeLeft }}</div>
      <div class="intermission-card">
        <div class="mechanic-icon" aria-hidden="true">{{ intermissionIcon }}</div>
        <div class="intermission-content">
          <p class="eyebrow">Next Round: {{ nextRound }} / {{ totalRounds }}</p>
          <h1 id="intermission-title">{{ intermissionTitle }}</h1>
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
          <div class="intermission-meta">
            <div class="score-pill">
              <span>Round Score</span>
              <strong>{{ personalResult?.roundScore ?? '-' }}</strong>
            </div>
            <div class="score-pill">
              <span>Total Score</span>
              <strong>{{ personalResult?.totalScore ?? '-' }}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-else-if="gamePhase === 'final'" class="game-shell" aria-labelledby="final-title">
      <p class="eyebrow">Final Result</p>
      <h1 id="final-title">Your Game Summary</h1>

      <div class="summary-grid">
        <article class="summary-card">
          <span>Your Rank</span>
          <strong>{{ finalResult?.rank ? `#${finalResult.rank}` : '-' }}</strong>
        </article>
        <article class="summary-card">
          <span>Total Score</span>
          <strong>{{ finalResult?.totalScore ?? personalResult?.totalScore ?? 0 }}</strong>
        </article>
      </div>

      <div class="breakdown-panel">
        <h2>Round Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Round</th>
              <th>Formula</th>
              <th>Result</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="round in roundBreakdown" :key="round.round">
              <td>{{ round.round }}</td>
              <td>{{ formatExpression(round.formula) || '(no submission)' }}</td>
              <td>
                <span class="result-chip" :class="getResultClass(round)">
                  {{ formatRoundResult(round) }}
                </span>
              </td>
              <td>{{ round.target ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!roundBreakdown.length" class="empty-state">No round results yet.</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import socket from '../socket'

const name = ref('')
const roomCode = ref('')
const message = ref('')
const hasJoined = ref(false)
const showTutorial = ref(false)
const isTutorial = ref(true)
const tutorialCompleted = ref(false)
const gamePhase = ref('waiting')
const target = ref(null)
const numbers = ref([])
const timeLeft = ref(0)
const expression = ref('')
const tutorialExpression = ref('')
const calculationResult = ref('')
const tutorialResult = ref('')
const personalResult = ref(null)
const currentRound = ref(0)
const nextRound = ref(0)
const totalRounds = ref(3)
const allowDivide = ref(false)
const intermissionTitle = ref('')
const intermissionBody = ref('')
const intermissionIcon = ref('')
const topThree = ref([])
const finalResult = ref(null)
const roundBreakdown = ref([])
const operators = ['+', '-', '*', '/', '(', ')', '=']
const tutorialTarget = 14
const tutorialNumbers = [2, 3, 4, 5]
const tutorialOperators = ['+', '-', '*', '/', '(', ')', '=']

let timerId = null

const formatExpression = (value) => String(value || '').replaceAll('*', '×').replaceAll('/', '÷')

const loadRoomCodeFromQuery = () => {
  const queryRoomCode = new URLSearchParams(window.location.search).get('roomCode')

  if (queryRoomCode) {
    roomCode.value = queryRoomCode.trim().toUpperCase()
  }
}

const getOperatorLabel = (operator) => {
  if (operator === '*') {
    return '×'
  }

  if (operator === '/') {
    return '÷'
  }

  return operator
}

const getRoundResultValue = (round) => {
  if (round?.roundedResult !== undefined && round.roundedResult !== null) {
    return round.roundedResult
  }

  if (round?.result !== undefined && round.result !== null) {
    return round.result
  }

  return null
}

const formatRoundResult = (round) => {
  const result = getRoundResultValue(round)

  if (result === null || !Number.isFinite(Number(result))) {
    return round?.isValid === false ? 'Invalid' : '-'
  }

  return result
}

const getResultClass = (round) => {
  const result = Number(getRoundResultValue(round))
  const roundTarget = Number(round?.target)

  if (!Number.isFinite(result) || !Number.isFinite(roundTarget)) {
    return 'result-far'
  }

  const difference = Math.abs(result - roundTarget)

  if (difference === 0) {
    return 'result-perfect'
  }

  if (difference <= 5) {
    return 'result-close'
  }

  return 'result-far'
}

const joinRoom = () => {
  socket.emit('join_room', {
    roomCode: roomCode.value.trim().toUpperCase(),
    playerName: name.value.trim()
  })
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

const appendToExpression = (value) => {
  expression.value += value
  calculationResult.value = ''
}

const deleteLastCharacter = () => {
  expression.value = expression.value.slice(0, -1)
  calculationResult.value = ''
}

const clearExpression = () => {
  expression.value = ''
  calculationResult.value = ''
}

const evaluateExpression = (expression) => {
  try {
    const result = Function("return (" + expression + ")")()

    if (!Number.isFinite(result)) {
      return 'Invalid'
    }

    return String(Math.round(result))
  } catch {
    return 'Invalid'
  }
}

const calculateResult = () => {
  calculationResult.value = evaluateExpression(expression.value)
}

const submitAnswer = () => {
  socket.emit('submit_expression', {
    roomCode: roomCode.value.trim().toUpperCase(),
    expression: expression.value
  })
}

const appendToTutorialExpression = (value) => {
  tutorialExpression.value += value
  tutorialResult.value = ''
}

const deleteLastTutorialCharacter = () => {
  tutorialExpression.value = tutorialExpression.value.slice(0, -1)
  tutorialResult.value = ''
}

const clearTutorialExpression = () => {
  tutorialExpression.value = ''
  tutorialResult.value = ''
}

const calculateTutorialResult = () => {
  tutorialResult.value = evaluateExpression(tutorialExpression.value)
}

const completeTutorial = () => {
  showTutorial.value = false
  tutorialCompleted.value = true
}

const handleJoinSuccess = () => {
  hasJoined.value = true
  showTutorial.value = true
  message.value = 'Joined successfully!'
}

const handleErrorMessage = (msg) => {
  message.value = msg
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
  showTutorial.value = false
  isTutorial.value = false
  currentRound.value = round || currentRound.value + 1
  totalRounds.value = roundTotal || totalRounds.value
  allowDivide.value = Boolean(roundAllowDivide)
  target.value = roundTarget
  numbers.value = roundNumbers
  expression.value = ''
  calculationResult.value = ''
  personalResult.value = null
  finalResult.value = null
  roundBreakdown.value = []
  startTimer(duration)
}

const handleRoundPersonalResult = (result) => {
  personalResult.value = result
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

const handleFinalResults = ({ totalRounds: roundTotal }) => {
  gamePhase.value = 'final'
  totalRounds.value = roundTotal || totalRounds.value
  clearTimer()
}

const handleFinalPersonalResult = (result) => {
  finalResult.value = result
  roundBreakdown.value = result.rounds || []
}

onMounted(() => {
  loadRoomCodeFromQuery()

  socket.on('join_success', handleJoinSuccess)
  socket.on('error_message', handleErrorMessage)
  socket.on('round_started', handleRoundStarted)
  socket.on('round_personal_result', handleRoundPersonalResult)
  socket.on('intermission_started', handleIntermissionStarted)
  socket.on('final_results', handleFinalResults)
  socket.on('final_personal_result', handleFinalPersonalResult)
})

onUnmounted(() => {
  clearTimer()
  socket.off('join_success', handleJoinSuccess)
  socket.off('error_message', handleErrorMessage)
  socket.off('round_started', handleRoundStarted)
  socket.off('round_personal_result', handleRoundPersonalResult)
  socket.off('intermission_started', handleIntermissionStarted)
  socket.off('final_results', handleFinalResults)
  socket.off('final_personal_result', handleFinalPersonalResult)
})
</script>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  min-width: 320px;
  color: #18324a;
  background: #edf7ff;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

.join-page {
  min-height: 100vh;
  padding: 32px 18px;
  background:
    radial-gradient(circle at top left, rgba(163, 216, 255, 0.48), transparent 34%),
    linear-gradient(145deg, #f7fbff 0%, #e8f5ff 48%, #d8ecfb 100%);
}

.join-shell,
.tutorial-shell,
.waiting-shell,
.game-shell {
  width: min(100%, 820px);
  margin: 0 auto;
}

.join-shell {
  min-height: calc(100vh - 64px);
  display: grid;
  place-items: center;
}

.join-panel,
.tutorial-shell,
.waiting-shell,
.game-shell,
.expression-panel,
.result-panel,
.leaderboard-panel {
  border: 1px solid rgba(119, 174, 214, 0.42);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 24px 60px rgba(68, 127, 171, 0.18);
}

.join-panel {
  width: min(100%, 460px);
  padding: 38px;
}

.tutorial-shell,
.waiting-shell {
  padding: 26px;
}

.tutorial-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.skip-button {
  min-width: 88px;
}

.tutorial-copy {
  margin-bottom: 22px;
  color: #365d7a;
  line-height: 1.5;
}

.tutorial-copy p {
  margin-bottom: 8px;
}

.tutorial-copy p:last-child {
  margin-bottom: 0;
}

.eyebrow {
  margin: 0 0 8px;
  color: #3f83b9;
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
  color: #133554;
  font-size: clamp(2rem, 8vw, 3rem);
  line-height: 1.05;
}

h2 {
  margin-bottom: 12px;
  color: #183b5a;
  font-size: 1.15rem;
}

.intro {
  margin-bottom: 28px;
  color: #4e6f89;
  line-height: 1.6;
}

.join-form {
  display: grid;
  gap: 16px;
}

label {
  display: grid;
  gap: 7px;
  color: #284d69;
  font-size: 0.92rem;
  font-weight: 700;
}

input {
  width: 100%;
  min-height: 48px;
  border: 1px solid #afcde4;
  border-radius: 8px;
  padding: 0 14px;
  color: #173650;
  background: #f8fcff;
  outline: none;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

input::placeholder {
  color: #83a4bc;
}

input:focus {
  border-color: #5aa2d6;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(90, 162, 214, 0.18);
}

.primary-button,
.secondary-button,
.choice-button {
  min-height: 46px;
  border: 0;
  border-radius: 8px;
  font-weight: 800;
  transition:
    transform 150ms ease,
    box-shadow 150ms ease,
    background 150ms ease;
}

.primary-button {
  color: #ffffff;
  background: #347fb7;
  box-shadow: 0 12px 24px rgba(52, 127, 183, 0.28);
}

.primary-button:hover,
.secondary-button:hover,
.choice-button:hover {
  transform: translateY(-1px);
}

.primary-button:hover {
  background: #276fa4;
}

.message {
  margin: 18px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  color: #265b82;
  background: #e8f5ff;
  line-height: 1.45;
}

.game-shell {
  padding: 26px;
}

.game-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
}

.timer-pill {
  flex: 0 0 auto;
  border-radius: 8px;
  padding: 12px 14px;
  color: #255d84;
  background: #e6f4ff;
  font-weight: 800;
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
  border: 1px solid #c5dced;
  border-radius: 8px;
  padding: 6px 10px;
  color: #557895;
  background: #f7fbff;
  font-size: 0.82rem;
  font-weight: 800;
}

.mechanic-icon {
  display: grid;
  place-items: center;
  width: clamp(82px, 22vw, 122px);
  aspect-ratio: 1;
  border: 1px solid #c5dced;
  border-radius: 50%;
  color: #255d84;
  background: #eef8ff;
  font-size: clamp(2.5rem, 8vw, 4rem);
  font-weight: 900;
  line-height: 1;
}

.intermission-content h1 {
  margin-bottom: 0;
  font-size: clamp(1.35rem, 5vw, 2rem);
}

.hint-box {
  margin-top: 10px;
  border: 1px solid #c5dced;
  border-radius: 8px;
  padding: 10px 12px;
  color: #365d7a;
  background: #f7fbff;
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
  color: #255d84;
}

.intermission-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.score-pill {
  border: 1px solid #c5dced;
  border-radius: 8px;
  padding: 10px 12px;
  color: #255d84;
  background: #eef8ff;
}

.score-pill span {
  display: block;
  margin-bottom: 4px;
  color: #557895;
  font-size: 0.8rem;
  font-weight: 700;
}

.score-pill strong {
  color: #163a58;
  font-size: 1.2rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.summary-card {
  border: 1px solid #c5dced;
  border-radius: 8px;
  padding: 18px;
  background: #f7fbff;
}

.summary-card span {
  display: block;
  margin-bottom: 8px;
  color: #557895;
  font-size: 0.86rem;
  font-weight: 700;
}

.summary-card strong {
  color: #163a58;
  font-size: clamp(2rem, 8vw, 3rem);
  line-height: 1.1;
}

.breakdown-panel {
  margin-top: 16px;
  border: 1px solid rgba(119, 174, 214, 0.42);
  border-radius: 8px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.88);
}

table {
  width: 100%;
  border-collapse: collapse;
  overflow-wrap: anywhere;
}

th,
td {
  border-bottom: 1px solid #c5dced;
  padding: 12px 10px;
  text-align: left;
}

th {
  color: #557895;
  font-size: 0.82rem;
  text-transform: uppercase;
}

td {
  color: #163a58;
  font-weight: 700;
}

.result-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  border-radius: 8px;
  padding: 5px 10px;
  font-weight: 900;
}

.result-perfect {
  color: #245a39;
  background: #dff4e7;
}

.result-close {
  color: #6a571b;
  background: #fff4bf;
}

.result-far {
  color: #5f5360;
  background: #eef2f7;
}

tbody tr:last-child td {
  border-bottom: 0;
}

.round-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  min-height: 112px;
  border: 1px solid #c5dced;
  border-radius: 8px;
  padding: 18px;
  background: #f7fbff;
}

.stat-card span {
  display: block;
  margin-bottom: 8px;
  color: #557895;
  font-size: 0.86rem;
  font-weight: 700;
}

.stat-card strong {
  color: #163a58;
  font-size: clamp(1.55rem, 7vw, 2.4rem);
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.expression-panel,
.result-panel,
.leaderboard-panel {
  margin-top: 16px;
  padding: 20px;
  box-shadow: none;
}

.expression-display {
  min-height: 52px;
  margin: 0;
  border-radius: 8px;
  padding: 14px;
  color: #163a58;
  background: #eef8ff;
  font-size: 1.15rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.calculation-result {
  margin: 12px 0 0;
  color: #276d9f;
  font-size: 1.1rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.button-grid {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.number-grid {
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
}

.operator-grid {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.tutorial-operator-grid {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.choice-button {
  border: 1px solid #b8d6eb;
  color: #1e587f;
  background: #f1f9ff;
}

.choice-button:hover {
  background: #e1f2ff;
  box-shadow: 0 8px 18px rgba(60, 129, 180, 0.16);
}

.operator-button {
  color: #276d9f;
  background: #e8f5ff;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.secondary-button {
  border: 1px solid #b8d6eb;
  color: #2e6f9f;
  background: #ffffff;
}

.secondary-button:hover {
  background: #f1f9ff;
  box-shadow: 0 8px 18px rgba(60, 129, 180, 0.12);
}

.result-panel p {
  margin-bottom: 8px;
  color: #365d7a;
  line-height: 1.45;
}

.result-panel p:last-child {
  margin-bottom: 0;
}

.leaderboard-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: rank;
}

.leaderboard-list li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  border: 1px solid #b8d6eb;
  border-radius: 8px;
  padding: 10px 14px;
  color: #1e587f;
  background: #f1f9ff;
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
  color: #ffffff;
  background: #347fb7;
  font-size: 0.9rem;
}

.leaderboard-list strong {
  color: #276d9f;
}

.empty-state {
  margin: 0;
  border-radius: 8px;
  padding: 14px;
  color: #365d7a;
  background: #eef8ff;
  line-height: 1.45;
}

@media (max-width: 640px) {
  .join-page {
    padding: 18px 12px;
  }

  .join-shell {
    min-height: calc(100vh - 36px);
  }

  .join-panel,
  .tutorial-shell,
  .waiting-shell,
  .game-shell {
    padding: 22px;
  }

  .game-header,
  .tutorial-header,
  .intermission-card {
    display: grid;
  }

  .timer-pill {
    width: 100%;
  }

  .round-grid,
  .action-row,
  .intermission-meta,
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .operator-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
