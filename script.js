const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Grid dimensions
const gridSize = 10;
const cellSize = canvas.width / gridSize;

// Load the UWI goal image
const uwiImage = new Image();
uwiImage.src = './uwi.jpeg';

// Load the Scarlet Ibis image
const ibisImage = new Image();
ibisImage.src = './scarlet_ibis.png';

// Player starting position
let player = { x: 0, y: gridSize - 1, direction: 0 }; // 0 = right, 1 = up, 2 = left, 3 = down

// Obstacles, eggs, and goal
let obstacles = [];
let eggs = []; // Array to store laid eggs
let goal = { x: gridSize - 1, y: 0 };

// Global storage for custom functions.
let customFunctions = {};

// Ensure the ibis image is loaded before drawing the initial state.
ibisImage.onload = () => {
  drawInitialState();
};

// -------------------- Drawing Functions --------------------

function drawInitialState() {
  drawGrid();
  drawPlayer();
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid lines.
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      ctx.strokeStyle = 'lightgray';
      ctx.strokeRect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }

  // Draw goal (UWI image) if loaded.
  if (uwiImage.complete) {
    ctx.drawImage(uwiImage, goal.x * cellSize, goal.y * cellSize, cellSize, cellSize);
  }

  // Draw obstacles.
  ctx.fillStyle = 'red';
  obstacles.forEach(obstacle => {
    ctx.fillRect(obstacle.x * cellSize, obstacle.y * cellSize, cellSize, cellSize);
  });

  // Draw eggs.
  eggs.forEach(egg => {
    const centerX = egg.x * cellSize + cellSize / 2;
    const centerY = egg.y * cellSize + cellSize / 2;
    ctx.beginPath();
    // Draw an oval egg.
    ctx.ellipse(centerX, centerY, cellSize / 4, cellSize / 3, 0, 0, 2 * Math.PI);
    ctx.fillStyle = 'yellow';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.stroke();
  });
}

function drawPlayer() {
  const centerX = player.x * cellSize + cellSize / 2;
  const centerY = player.y * cellSize + cellSize / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((-player.direction * Math.PI) / 2);
  ctx.drawImage(ibisImage, -cellSize / 2, -cellSize / 2, cellSize, cellSize);
  ctx.restore();
}

// -------------------- New Commands: Lay Egg and Pick Up Egg --------------------

// Lays an egg at the current player location.
function layEgg() {
  eggs.push({ x: player.x, y: player.y });
  drawGrid();
  drawPlayer();
}

// Picks up an egg from the current player location (if one exists).
function pickUpEgg() {
  // Look for an egg at the player's current cell.
  for (let i = eggs.length - 1; i >= 0; i--) {
    if (eggs[i].x === player.x && eggs[i].y === player.y) {
      eggs.splice(i, 1); // Remove one egg from the cell.
      break; // Remove only one egg per command.
    }
  }
  drawGrid();
  drawPlayer();
}

// -------------------- Parsing Code with Loops & Functions --------------------

/*
  The parseBlock function reads lines of code (from the text area) and converts them into
  a commands array. It supports:
    - for-loops (e.g., "for 3:" followed by an indented block)
    - while-loops (e.g., "while front_clear:" followed by an indented block)
    - Custom function definitions (allowed only at the top level)
    - Regular commands (like "move", "turn left", "lay egg", or "pick up egg")
*/
function parseBlock(lines, start, baseIndent) {
  let commands = [];
  let i = start;

  while (i < lines.length) {
    let line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Determine the indentation (assume a tab = 4 spaces).
    let indent = 0;
    for (let ch of line) {
      if (ch === ' ') {
        indent++;
      } else if (ch === '\t') {
        indent += 4;
      } else {
        break;
      }
    }

    // If this line's indent is less than the base, the block has ended.
    if (indent < baseIndent) break;

    const trimmed = line.trim();

    // Handle for-loops (syntax: "for 3:")
    if (trimmed.startsWith("for ")) {
      let parts = trimmed.split(' ');
      let countStr = parts[1].replace(":", "");
      let count = parseInt(countStr);
      if (isNaN(count)) count = 0;
      i++;
      // Parse the block inside the for-loop (should be indented one level more)
      let { commands: loopCommands, nextIndex } = parseBlock(lines, i, indent + 1);
      i = nextIndex;
      // Unroll the loop by repeating its commands count times.
      for (let j = 0; j < count; j++) {
        commands.push(...loopCommands);
      }
    }
    // Handle while-loops (syntax: "while front_clear:")
    else if (trimmed.startsWith("while ")) {
      let conditionPart = trimmed.substring(6); // Remove "while "
      if (conditionPart.endsWith(":")) {
        conditionPart = conditionPart.slice(0, -1).trim();
      }
      i++;
      let { commands: whileCommands, nextIndex } = parseBlock(lines, i, indent + 1);
      i = nextIndex;
      commands.push({
        type: "while",
        condition: conditionPart.toLowerCase(),
        commands: whileCommands
      });
    }
    // Handle function definitions (syntax: "function turn_right:")
    else if (trimmed.startsWith("function ")) {
      if (baseIndent === 0) {
        let parts = trimmed.split(' ');
        let funcName = parts[1].replace(":", "").trim();
        i++;
        let { commands: funcCommands, nextIndex } = parseBlock(lines, i, indent + 1);
        i = nextIndex;
        customFunctions[funcName] = funcCommands;
      } else {
        commands.push(trimmed.toLowerCase());
        i++;
      }
    }
    // Otherwise, it's a regular command.
    else {
      commands.push(trimmed.toLowerCase());
      i++;
    }
  }

  return { commands, nextIndex: i };
}

// The main parseCode function resets customFunctions and returns the main commands.
function parseCode(input) {
  customFunctions = {}; // Reset previously defined custom functions.
  const lines = input.split('\n');
  let { commands: mainCommands } = parseBlock(lines, 0, 0);
  return { mainCommands, functions: customFunctions };
}

// -------------------- Evaluating Conditions --------------------

/*
  Currently, the only supported condition is "front_clear". This function returns true if
  the cell in front of the player is clear (i.e. within bounds and not blocked by an obstacle).
*/
function evaluateCondition(condition) {
  if (condition === "front_clear") {
    const directions = [
      { dx: 1, dy: 0 },  // right
      { dx: 0, dy: -1 }, // up
      { dx: -1, dy: 0 }, // left
      { dx: 0, dy: 1 }   // down
    ];
    const move = directions[player.direction];
    const newX = player.x + move.dx;
    const newY = player.y + move.dy;
    if (
      newX >= 0 && newX < gridSize &&
      newY >= 0 && newY < gridSize &&
      !obstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY)
    ) {
      return true;
    }
    return false;
  }
  return false;
}

// -------------------- Executing Commands --------------------

/*
  The executeCommands function processes the parsed commands sequentially.
  It handles:
    - Built-in commands ("move", "turn left", "lay egg", "pick up egg")
    - Custom function calls (by checking customFunctions)
    - While-loops (by evaluating conditions at runtime)
*/
function executeCommands(commands) {
  const commandQueue = [...commands]; // Create a copy of the commands array

  function processNextCommand() {
    if (commandQueue.length === 0) return; // No more commands.

    const command = commandQueue.shift();

    // Handle while-loop command objects.
    if (typeof command === 'object' && command.type === "while") {
      if (evaluateCondition(command.condition)) {
        // If condition is true, schedule the loop block commands and re-add the loop.
        commandQueue.unshift(command);
        commandQueue.unshift(...command.commands);
        processNextCommand();
        return;
      } else {
        setTimeout(processNextCommand, 0);
        return;
      }
    }

    // If the command matches a custom function name, insert its commands.
    if (typeof command === 'string' && customFunctions[command]) {
      commandQueue.unshift(...customFunctions[command]);
      processNextCommand();
      return;
    }

    // Execute built-in commands.
    if (command === 'move') {
      const directions = [
        { dx: 1, dy: 0 },  // right
        { dx: 0, dy: -1 }, // up
        { dx: -1, dy: 0 }, // left
        { dx: 0, dy: 1 }   // down
      ];
      const moveDir = directions[player.direction];
      const newX = player.x + moveDir.dx;
      const newY = player.y + moveDir.dy;

      // Check for a valid move (within bounds and no obstacles)
      if (
        newX >= 0 && newX < gridSize &&
        newY >= 0 && newY < gridSize &&
        !obstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY)
      ) {
        animateMove(player.x, player.y, newX, newY, 0, processNextCommand);
      } else {
        setTimeout(processNextCommand, 0);
      }
    } else if (command === 'turn left') {
      player.direction = (player.direction + 1) % 4;
      drawGrid();
      drawPlayer();
      setTimeout(processNextCommand, 400);
    }
    // New command: Lay Egg.
    else if (command === 'lay egg') {
      layEgg();
      setTimeout(processNextCommand, 0);
    }
    // New command: Pick Up Egg.
    else if (command === 'pick up egg') {
      pickUpEgg();
      setTimeout(processNextCommand, 0);
    } else {
      // Skip any unrecognized command.
      setTimeout(processNextCommand, 0);
    }
  }

  processNextCommand();
}

// -------------------- Animating Movement --------------------

function animateMove(startX, startY, endX, endY, step = 0, callback) {
  const totalSteps = 10;
  const deltaX = ((endX - startX) * cellSize) / totalSteps;
  const deltaY = ((endY - startY) * cellSize) / totalSteps;

  if (step <= totalSteps) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    const currentX = startX * cellSize + deltaX * step;
    const currentY = startY * cellSize + deltaY * step;

    ctx.save();
    ctx.translate(currentX + cellSize / 2, currentY + cellSize / 2);
    ctx.rotate((-player.direction * Math.PI) / 2);
    ctx.drawImage(ibisImage, -cellSize / 2, -cellSize / 2, cellSize, cellSize);
    ctx.restore();

    setTimeout(() => animateMove(startX, startY, endX, endY, step + 1, callback), 50);
  } else {
    player.x = endX;
    player.y = endY;
    drawGrid();
    drawPlayer();
    callback();
  }
}

// -------------------- Handling Obstacles & UI --------------------

function placeObstacle(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Convert pixel coordinates to grid coordinates.
  const gridX = Math.floor(x / cellSize);
  const gridY = Math.floor(y / cellSize);

  // Prevent placing obstacles on the player's or goal's cell.
  if (
    (gridX === player.x && gridY === player.y) ||
    (gridX === goal.x && gridY === goal.y) ||
    obstacles.some(obstacle => obstacle.x === gridX && obstacle.y === gridY)
  ) {
    return;
  }

  obstacles.push({ x: gridX, y: gridY });
  drawGrid();
  drawPlayer();
}

canvas.addEventListener('click', placeObstacle);

document.getElementById('toggle-instructions').addEventListener('click', () => {
  const instructions = document.getElementById('instructions');
  const button = document.getElementById('toggle-instructions');

  if (instructions.style.display === 'none') {
    instructions.style.display = 'block';
    button.textContent = 'Hide Instructions';
  } else {
    instructions.style.display = 'none';
    button.textContent = 'Show Instructions';
  }
});

// -------------------- Running the Code --------------------

document.getElementById('runCode').addEventListener('click', () => {
  const codeInput = document.getElementById('codeInput').value;
  const { mainCommands, functions } = parseCode(codeInput);
  // customFunctions is updated via parseCode; now execute the main commands.
  executeCommands(mainCommands);
});
