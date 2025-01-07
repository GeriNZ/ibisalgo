const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Grid dimensions
const gridSize = 10;
const cellSize = canvas.width / gridSize;

// Player starting position
let player = { x: 0, y: gridSize - 1, direction: 0 }; // Direction: 0 = right, 1 = up, 2 = left, 3 = down

// Obstacles and goal
let obstacles = [];
let goal = { x: gridSize - 1, y: 0 };

// Load the Scarlet Ibis image
const ibisImage = new Image();
ibisImage.src = './scarlet_ibis.png';

// Ensure the image is loaded before drawing
ibisImage.onload = () => {
  drawInitialState();
};

// Draw the initial state (grid and player)
function drawInitialState() {
  drawGrid();
  drawPlayer();
}

// Draw the grid, obstacles, and goal
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      ctx.strokeStyle = 'lightgray';
      ctx.strokeRect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }

  // Draw goal
  ctx.fillStyle = 'green';
  ctx.fillRect(goal.x * cellSize, goal.y * cellSize, cellSize, cellSize);

  // Draw obstacles
  ctx.fillStyle = 'red';
  obstacles.forEach(obstacle => {
    ctx.fillRect(obstacle.x * cellSize, obstacle.y * cellSize, cellSize, cellSize);
  });
}

// Draw the player with proper rotation
function drawPlayer() {
  const centerX = player.x * cellSize + cellSize / 2;
  const centerY = player.y * cellSize + cellSize / 2;

  ctx.save(); // Save the canvas state
  ctx.translate(centerX, centerY); // Move the origin to the player's center
  ctx.rotate((-player.direction * Math.PI) / 2); // Rotate counterclockwise
  ctx.drawImage(ibisImage, -cellSize / 2, -cellSize / 2, cellSize, cellSize); // Draw the image centered
  ctx.restore(); // Restore the canvas state
}

// Place an obstacle at the clicked grid cell
function placeObstacle(event) {
  const rect = canvas.getBoundingClientRect(); // Get canvas position
  const x = event.clientX - rect.left; // Calculate x relative to canvas
  const y = event.clientY - rect.top; // Calculate y relative to canvas

  // Convert pixel coordinates to grid coordinates
  const gridX = Math.floor(x / cellSize);
  const gridY = Math.floor(y / cellSize);

  // Prevent placing obstacles on the player or goal
  if (
    (gridX === player.x && gridY === player.y) || // Player's position
    (gridX === goal.x && gridY === goal.y) || // Goal position
    obstacles.some(obstacle => obstacle.x === gridX && obstacle.y === gridY) // Existing obstacle
  ) {
    return; // Do nothing if the cell is invalid
  }

  // Add the obstacle and redraw the grid
  obstacles.push({ x: gridX, y: gridY });
  drawGrid();
  drawPlayer();
}

// Parse and run commands
document.getElementById('runCode').addEventListener('click', () => {
  const codeInput = document.getElementById('codeInput').value;

  // Parse custom functions
  parseCustomFunctions(codeInput);

  // Extract commands (excluding function definitions)
  const commands = codeInput
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('function') && line.length > 0);

  // Execute the commands
  executeCommands(commands);
});
// Execute commands
let customFunctions = {}; // Store custom functions as { name: commands[] }

// Parse and execute commands, including custom functions
function executeCommands(commands) {
  commandQueue = commands.flatMap(command => expandCommand(command.trim().toLowerCase())); // Expand all commands
  executeNextCommand();
}

// Expand a command (handles custom functions)
function expandCommand(command) {
  if (customFunctions[command]) {
    return customFunctions[command]; // Return the function's commands for sequential execution
  }
  return [command]; // Return the command as-is if it's not a function
}


// Add a function definition syntax
function parseCustomFunctions(input) {
  const lines = input.split('\n').map(line => line.trim());
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('function')) {
      const functionName = line.split(' ')[1].replace(':', '').trim(); // Extract function name
      const functionCommands = [];
      i++;

      // Collect all commands inside the function
      while (i < lines.length && lines[i] && !lines[i].startsWith('function')) {
        functionCommands.push(lines[i].trim().toLowerCase());
        i++;
      }

      // Store the function definition
      customFunctions[functionName] = functionCommands;
    } else {
      i++;
    }
  }
}



function executeNextCommand() {
  if (commandQueue.length === 0) return; // Stop if no commands are left

  const command = commandQueue.shift(); // Get the next command

  if (customFunctions[command]) {
    // If the command is a custom function, enqueue its commands
    const expandedCommands = customFunctions[command];
    commandQueue = [...expandedCommands, ...commandQueue]; // Add function commands to the queue
    setTimeout(() => executeNextCommand(), 0); // Return to let the main loop continue
    return;
  }

  if (command === 'move') {
    const directions = [
      { dx: 1, dy: 0 }, // right
      { dx: 0, dy: -1 }, // up
      { dx: -1, dy: 0 }, // left
      { dx: 0, dy: 1 } // down
    ];
    const move = directions[player.direction];
    const newX = player.x + move.dx;
    const newY = player.y + move.dy;

    // Check boundaries and obstacles
    if (
      newX >= 0 && newX < gridSize &&
      newY >= 0 && newY < gridSize &&
      !obstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY)
    ) {
      animateMove(player.x, player.y, newX, newY, 0);
    } else {
      setTimeout(() => executeNextCommand(), 0);
    }
  } else if (command === 'turn left') {
    player.direction = (player.direction + 1) % 4;
    drawGrid();
    drawPlayer();
    setTimeout(() => executeNextCommand(), 400); // Delay to allow smooth execution
  }
}


// Animate movement
function animateMove(startX, startY, endX, endY, step = 0) {
  const totalSteps = 10;
  const deltaX = (endX - startX) * cellSize / totalSteps;
  const deltaY = (endY - startY) * cellSize / totalSteps;

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

    setTimeout(() => animateMove(startX, startY, endX, endY, step + 1), 50);
  } else {
    player.x = endX;
    player.y = endY;
    drawGrid();
    drawPlayer();
    executeNextCommand();
  }
}

canvas.addEventListener('click', placeObstacle);


