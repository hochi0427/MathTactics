const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = {};

const ROUND_CONFIGS = [
  {
    round: 1,
    allowDivide: false,
    includeDecimal: false,
  },
  {
    round: 2,
    allowDivide: true,
    includeDecimal: false,
  },
  {
    round: 3,
    allowDivide: true,
    includeDecimal: true,
  },
];

const ROUND_DURATION = 60;
const INTERMISSION_DURATION = 8;

function hasOnlyAllowedCharacters(expression) {
  return /^[0-9+\-*/().\s]+$/.test(expression);
}

function getNumberTokens(expression) {
  return (expression.match(/\d+(?:\.\d+)?/g) || []).map(Number);
}

function usesExactlyProvidedNumbers(expression, providedNumbers) {
  const tokens = getNumberTokens(expression);

  if (tokens.length !== providedNumbers.length) {
    return false;
  }

  const sortedTokens = [...tokens].sort((a, b) => a - b);
  const sortedProvidedNumbers = [...providedNumbers].sort((a, b) => a - b);

  return sortedTokens.every((token, index) => token === sortedProvidedNumbers[index]);
}

function getIntermissionMessage(round) {
  if (round === 1) {
    return {
      title: "New Operator Unlocked",
      body: "Try using ÷ to reduce large numbers.",
    };
  }

  return {
    title: "New Number Type Unlocked",
    body: "Multiply by a decimal to make a number smaller. Divide by a decimal to make it larger.",
  };
}

function getTopThree(players) {
  return Object.entries(players)
    .map(([playerSocketId, player]) => ({
      playerSocketId,
      name: player.name,
      totalScore: player.totalScore,
      roundScore: player.lastRoundScore || 0,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3);
}

function getStandings(players) {
  return Object.entries(players)
    .map(([playerSocketId, player]) => ({
      playerSocketId,
      name: player.name,
      totalScore: player.totalScore,
      rounds: player.roundHistory || [],
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function sendFinalResults(roomCode, room) {
  const standings = getStandings(room.players).map((player, index) => ({
    ...player,
    rank: index + 1,
  }));

  io.to(roomCode).emit("final_results", {
    standings,
    totalRounds: ROUND_CONFIGS.length,
  });

  for (const player of standings) {
    io.to(player.playerSocketId).emit("final_personal_result", {
      rank: player.rank,
      totalScore: player.totalScore,
      rounds: player.rounds,
      totalRounds: ROUND_CONFIGS.length,
    });
  }
}

function createNumbers(config) {
  const integers = Array.from({ length: config.includeDecimal ? 3 : 4 }, () => Math.floor(Math.random() * 9) + 1);

  if (config.includeDecimal) {
    return [...integers, 0.5];
  }

  return integers;
}

function startRound(roomCode, roundIndex) {
  const room = rooms[roomCode];

  if (!room) {
    return;
  }

  const config = ROUND_CONFIGS[roundIndex];

  if (!config) {
    room.state = "final";
    room.currentRound = null;
    sendFinalResults(roomCode, room);
    return;
  }

  const target = Math.floor(Math.random() * 100) + 1;
  const numbers = createNumbers(config);

  room.currentRoundIndex = roundIndex;
  room.currentRound = {
    ...config,
    target,
    numbers,
    startTime: Date.now(),
    duration: ROUND_DURATION,
    submissions: {},
    isResolved: false,
  };
  room.state = "playing";

  if (room.roundTimeout) {
    clearTimeout(room.roundTimeout);
  }

  if (room.intermissionTimeout) {
    clearTimeout(room.intermissionTimeout);
    room.intermissionTimeout = null;
  }

  room.roundTimeout = setTimeout(() => {
    resolveRound(roomCode);
  }, ROUND_DURATION * 1000);

  io.to(roomCode).emit("round_started", {
    round: config.round,
    totalRounds: ROUND_CONFIGS.length,
    target,
    numbers,
    duration: ROUND_DURATION,
    allowDivide: config.allowDivide,
    includeDecimal: config.includeDecimal,
  });

  io.to(roomCode).emit("submission_count_updated", {
    submittedCount: 0,
    totalPlayers: Object.keys(room.players).length,
  });

  console.log(`Round ${config.round} started for room ${roomCode}`);
}

function evaluateExpression(expression) {
  try {
    const result = Function(`"use strict"; return (${expression})`)();

    if (typeof result !== "number" || !Number.isFinite(result)) {
      return { isValid: false, result: 0 };
    }

    return { isValid: true, result };
  } catch (error) {
    return { isValid: false, result: 0 };
  }
}

function validateExpression(expression, numbers, config) {
  const trimmedExpression = String(expression || "").trim();

  if (!trimmedExpression) {
    return { isValid: false, reason: "Expression is empty" };
  }

  if (!hasOnlyAllowedCharacters(trimmedExpression)) {
    return { isValid: false, reason: "Expression contains invalid characters" };
  }

  if (!config.allowDivide && trimmedExpression.includes("/")) {
    return { isValid: false, reason: "Division is not allowed in this round" };
  }

  if (!usesExactlyProvidedNumbers(trimmedExpression, numbers)) {
    return { isValid: false, reason: "Expression must use each provided number exactly once" };
  }

  return { isValid: true, reason: null };
}

function validateAndEvaluateExpression(expression, numbers, config) {
  const trimmedExpression = String(expression || "").trim();
  const validation = validateExpression(trimmedExpression, numbers, config);

  if (!validation.isValid) {
    return { isValid: false, result: 0, reason: validation.reason };
  }

  const evaluation = evaluateExpression(trimmedExpression);

  if (!evaluation.isValid) {
    return { isValid: false, result: 0, reason: "Expression could not be evaluated" };
  }

  return { ...evaluation, reason: null };
}

function scoreExpression({ expression, result, isValid, target }) {
  const roundedResult = isValid ? Math.round(result) : 0;
  const baseScore = Math.max(0, 100 - Math.abs(target - roundedResult));
  const usedDivision = isValid && expression.includes("/");
  const exactMatch = roundedResult === target;
  let bonus = 0;

  if (usedDivision) {
    bonus += 10;
  }

  if (exactMatch) {
    bonus += 20;
  }

  return {
    roundedResult,
    usedDivision,
    exactMatch,
    roundScore: baseScore + bonus,
  };
}

function resolveRound(roomCode) {
  const room = rooms[roomCode];

  if (!room || !room.currentRound || room.currentRound.isResolved) {
    return;
  }

  const currentRound = room.currentRound;
  currentRound.isResolved = true;

  const playerResults = Object.entries(room.players).map(([playerSocketId, player]) => {
    const expression = currentRound.submissions[playerSocketId]?.expression || "";
    const evaluation = validateAndEvaluateExpression(expression, currentRound.numbers, currentRound);
    const score = scoreExpression({
      expression,
      result: evaluation.result,
      isValid: evaluation.isValid,
      target: currentRound.target,
    });

    const result = {
      expression,
      result: evaluation.result,
      roundedResult: score.roundedResult,
      isValid: evaluation.isValid,
      usedDivision: score.usedDivision,
      exactMatch: score.exactMatch,
      roundScore: score.roundScore,
    };

    player.totalScore += result.roundScore;
    player.lastRoundScore = result.roundScore;
    player.roundHistory = player.roundHistory || [];
    player.roundHistory.push({
      round: currentRound.round,
      score: result.roundScore,
      formula: expression || "(no submission)",
      result: result.result,
      roundedResult: result.roundedResult,
      target: currentRound.target,
      isValid: result.isValid,
    });

    return {
      playerSocketId,
      name: player.name,
      totalScore: player.totalScore,
      ...result,
    };
  });

  currentRound.results = playerResults;

  const topThree = [...playerResults]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3)
    .map(({ playerSocketId, name, roundScore, totalScore, expression, roundedResult, isValid }) => ({
      playerSocketId,
      name,
      roundScore,
      totalScore,
      expression,
      roundedResult,
      isValid,
    }));

  io.to(roomCode).emit("round_results", {
    round: currentRound.round,
    totalRounds: ROUND_CONFIGS.length,
    target: currentRound.target,
    topThree,
  });

  for (const result of playerResults) {
    io.to(result.playerSocketId).emit("round_personal_result", {
      roundScore: result.roundScore,
      totalScore: result.totalScore,
      expression: result.expression,
      roundedResult: result.roundedResult,
      isValid: result.isValid,
      round: currentRound.round,
    });
  }

  if (currentRound.round >= ROUND_CONFIGS.length) {
    room.state = "final";
    room.currentRound = null;
    sendFinalResults(roomCode, room);
    console.log(`Final results sent for room ${roomCode}`);
    return;
  }

  room.state = "intermission";

  const message = getIntermissionMessage(currentRound.round);

  io.to(roomCode).emit("intermission_started", {
    roundCompleted: currentRound.round,
    nextRound: currentRound.round + 1,
    totalRounds: ROUND_CONFIGS.length,
    duration: INTERMISSION_DURATION,
    title: message.title,
    body: message.body,
    topThree,
  });

  room.intermissionTimeout = setTimeout(() => {
    startRound(roomCode, room.currentRoundIndex + 1);
  }, INTERMISSION_DURATION * 1000);

  console.log(`Round ${currentRound.round} resolved for room ${roomCode}`);
}

// app.get("/", (req, res) => {
//   res.send("Server is running");
// });

const path = require("path");

// serve frontend (Vue build)
app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("/{*any}", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create_room", () => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[roomCode] = {
      code: roomCode,
      players: {},
      state: "waiting",
      currentRound: null,
      currentRoundIndex: -1,
      roundTimeout: null,
      intermissionTimeout: null,
    };

    socket.join(roomCode);

    console.log("Room created:", roomCode);

    socket.emit("room_created", { roomCode });
  });

  socket.on("join_room", ({ roomCode, playerName }) => {
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("error_message", "Room not found");
      return;
    }

    socket.join(roomCode);

    room.players[socket.id] = {
      name: playerName,
      totalScore: 0,
      roundHistory: [],
    };

    console.log(`${playerName} joined room ${roomCode}`);

    socket.emit("join_success");

    io.to(roomCode).emit("player_list_updated", room.players);
  });

  socket.on("start_game", (roomCode) => {
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("error_message", "Room not found");
      return;
    }

    Object.values(room.players).forEach((player) => {
      player.totalScore = 0;
      player.lastRoundScore = 0;
      player.roundHistory = [];
    });

    startRound(roomCode, 0);
    console.log(`Game started for room ${roomCode}`);
  });

  socket.on("submit_expression", ({ roomCode, expression }) => {
    const room = rooms[roomCode];

    if (!room || room.state !== "playing" || !room.currentRound || room.currentRound.isResolved) {
      return;
    }

    room.currentRound.submissions[socket.id] = {
      expression: String(expression || ""),
    };

    const submittedCount = Object.keys(room.currentRound.submissions).length;
    const totalPlayers = Object.keys(room.players).length;

    io.to(roomCode).emit("submission_count_updated", {
      submittedCount,
      totalPlayers,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(roomCode).emit("player_list_updated", room.players);
      }
    }
  });
});



// server.listen(3000, () => {
//   console.log("Server listening on port 3000");
// });

server.listen(process.env.PORT || 3000, () => {
  console.log("Server listening");
});
