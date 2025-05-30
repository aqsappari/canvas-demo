// Canvas Definition
const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

// UI Elements
const scoreValueElement = document.getElementById("score-value");
const pauseButton = document.getElementById("pause-button");
const pauseOverlay = document.getElementById("pause-overlay");
const bodyElement = document.body; // Reference to the body element
const scoreContainer = document.getElementById("score-container"); // Reference to score container
const instructionOverlay = document.getElementById("instruction-overlay"); // NEW
const startGameButton = document.getElementById("start-game-button"); // NEW

let score = 0; // Initialize score
let isPaused = false; // Game pause state
// NEW: Check if user has played before using sessionStorage
let hasPlayedBefore = sessionStorage.getItem("hasPlayedGame") === "true";

// Initialization of Constants
const colors = [
  "#FF5733", // Orange-Red (Mouse)
  "#33FF57", // Green (Ball)
  "#3357FF", // Blue (Hole active)
  "#F0F0F0", // Light Gray (unused)
  "#000000", // Black (Hole default)
  "#FF33A1", // Pink (unused)
  "#33FFF5", // Cyan (unused)
  "#FF8C33", // Dark Orange (unused)
];
const initialBallRadius = 20;
const holeRadius = 70;
const suckForce = 0.08; // How strongly the hole pulls the ball (adjusted for smoother animation)
const shrinkRate = 0.8; // How fast the ball shrinks (applied multiplicatively)
const minBallRadius = 1; // Minimum radius before ball is considered fully sucked

const mouse = {
  x: undefined, // Start undefined so mouse circle doesn't jump until mouse has moved
  y: undefined,
};

// Initialization of Variables
let circleMouse;
let circleObject;
let holes = []; // Use an array to manage holes more easily

// Event Listeners
window.addEventListener("mousemove", (event) => {
  mouse.x = event.x;
  mouse.y = event.y;
});

// Touch Event Listeners for mobile/touchscreen support
canvas.addEventListener("touchstart", (event) => {
  event.preventDefault(); // Prevent default browser touch behaviors (like scrolling)
  if (event.touches.length > 0) {
    mouse.x = event.touches[0].clientX;
    mouse.y = event.touches[0].clientY;
  }
});

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault(); // Prevent default browser touch behaviors
  if (event.touches.length > 0) {
    mouse.x = event.touches[0].clientX;
    mouse.y = event.touches[0].clientY;
  }
});

window.addEventListener("resize", () => {
  // When resized, re-init the game state but don't re-show instructions
  setupGame();
  // If game was paused, ensure it stays paused after resize, otherwise resume animation
  if (isPaused) {
    // No action needed, animate() won't be called if isPaused
  } else {
    animate(); // Re-kick off animation loop if not paused
  }
});

// Toggle pause state
function togglePause() {
  isPaused = !isPaused; // Toggle the state

  // Update UI based on pause state
  if (isPaused) {
    pauseOverlay.classList.add("active"); // Show overlay
    canvas.classList.add("dimmed"); // Dim canvas
    pauseButton.innerHTML = '<i class="fas fa-play"></i>'; // Change button to Play icon
    bodyElement.classList.add("paused"); // Show cursor
  } else {
    pauseOverlay.classList.remove("active"); // Hide overlay
    canvas.classList.remove("dimmed"); // Brighten canvas
    pauseButton.innerHTML = '<i class="fas fa-pause"></i>'; // Change button to Pause icon
    bodyElement.classList.remove("paused"); // Hide cursor
    // Request a new animation frame to resume the loop if it was halted
    animate();
  }
}

// Pause button click listener
pauseButton.addEventListener("click", (event) => {
  event.stopPropagation(); // CRITICAL FIX: Stop event from bubbling up
  togglePause();
});

// Resume on screen click when paused (click anywhere on the dimmed canvas/overlay)
document.addEventListener("click", (event) => {
  // Only resume if currently paused AND the click target is NOT part of the UI controls
  const target = event.target;
  if (
    isPaused &&
    !pauseButton.contains(target) &&
    !scoreValueElement.contains(target) &&
    !scoreValueElement.parentNode.contains(target) &&
    !instructionOverlay.contains(target) // NEW: Don't resume if clicking instruction overlay
  ) {
    togglePause();
  }
});

// Circle Class
class Circle {
  constructor(x, y, dx, dy, radius, color) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.radius = radius;
    this.color = color;
    this.initialRadius = radius; // Store initial radius for reset
    this.isSucked = false; // New state for sucking animation
    this.targetHole = null; // Reference to the hole being sucked into
    this.isCollecting = false; // Flag to prevent multiple score increments
  }

  draw() {
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    c.fillStyle = this.color;
    c.fill();
    c.closePath();
  }

  update() {
    // Only update ball's physics and position if not paused
    if (!isPaused) {
      // If the ball is currently being sucked into a hole
      if (this.isSucked && this.targetHole) {
        // Calculate vector from ball to hole center
        const dxToHole = this.targetHole.x - this.x;
        const dyToHole = this.targetHole.y - this.y;
        const distToHole = Math.sqrt(dxToHole * dxToHole + dyToHole * dyToHole);

        // Move towards the hole's center with a continuous pull
        if (distToHole > 1) {
          // Apply pull until very close to prevent jitter
          this.dx += dxToHole * suckForce; // Apply force
          this.dy += dyToHole * suckForce; // Apply force

          // Dampen velocity to prevent overshooting and oscillations
          this.dx *= 0.95; // Adjust damping factor
          this.dy *= 0.95; // Adjust damping factor
        } else {
          this.dx = 0; // Snap to exact center when very close
          this.dy = 0;
          this.x = this.targetHole.x;
          this.y = this.targetHole.y;
        }

        // Gradually shrink the radius
        if (this.radius > minBallRadius) {
          this.radius *= shrinkRate; // Multiplicative shrink
        } else {
          this.radius = 0; // Ensure it disappears fully
        }

        // Check if sucking animation is complete (very small and at center)
        if (this.radius <= minBallRadius && distToHole <= 10) {
          this.isSucked = false; // End sucking animation state
          const suckedHole = this.targetHole; // Store reference for reset
          this.targetHole = null; // Clear target hole reference

          this.radius = this.initialRadius;
          // Random spawn within bounds
          const spawnX =
            Math.random() * (canvas.width - 2 * holeRadius) + holeRadius;
          const spawnY =
            Math.random() * (canvas.height - 2 * holeRadius) + holeRadius;
          this.x = spawnX;
          this.y = spawnY;
          this.dx = 0; // Stationary
          this.dy = 0; // Stationary
          if (suckedHole) {
            suckedHole.color = colors[4]; // Reset hole color
            suckedHole.isCollecting = false; // Reset hole's collecting state
          }
        }
      } else {
        // Normal movement logic (if not being sucked)

        // Bounce off the mouse circle
        const distX = this.x - circleMouse.x;
        const distY = this.y - circleMouse.y;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < this.radius + circleMouse.radius) {
          const angle = Math.atan2(distY, distX);
          this.dx = Math.cos(angle) * 10; // Push away speed
          this.dy = Math.sin(angle) * 10; // Push away speed
        }

        // Bounce off the edges of the canvas
        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
          this.dx = -this.dx;
        }
        if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
          this.dy = -this.dy;
        }

        // Handle potential hole collisions (only if not already being sucked)
        this.handleHoleCollisions();
      }

      // Update position based on dx and dy for both normal and sucking states
      this.x += this.dx;
      this.y += this.dy;
    } // End of !isPaused block for ball movement

    this.draw();
  }

  handleHoleCollisions() {
    holes.forEach((hole) => {
      // Check if ball is already being sucked OR if this hole is already collecting a ball
      if (this.isSucked || hole.isCollecting) return; // Prevent multiple triggers/score increments

      const distanceToHole = Math.sqrt(
        (this.x - hole.x) ** 2 + (this.y - hole.y) ** 2
      );

      // If the ball enters the hole's influence (defined by radius)
      if (distanceToHole < this.radius + hole.radius - 30) {
        // Slight buffer for entry
        this.isSucked = true; // Start sucking animation
        this.targetHole = hole; // Set target hole
        hole.color = colors[2]; // Change hole color immediately
        hole.isCollecting = true; // Mark this hole as collecting

        // Increment score (only once per entry)
        score++;
        scoreValueElement.textContent = score; // Update score element

        // Immediately dampen current velocity to start the suck animation smoothly
        this.dx *= 0.5; // Dampen current velocity
        this.dy *= 0.5; // Dampen current velocity
      }
    });
  }

  mouseUpdate() {
    // Only update mouse circle position if mouse has moved
    if (mouse.x !== undefined && mouse.y !== undefined) {
      this.x = mouse.x;
      this.y = mouse.y;
    }
    this.draw();
  }
}

// NEW: Function to set up the game elements (called after instructions or directly)
function setupGame() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const initialSpawnX =
    Math.random() * (canvas.width - 2 * holeRadius) + holeRadius;
  const initialSpawnY =
    Math.random() * (canvas.height - 2 * holeRadius) + holeRadius;

  circleObject = new Circle(
    initialSpawnX,
    initialSpawnY,
    0,
    0,
    initialBallRadius,
    colors[1]
  );

  holes = [];
  holes = [
    new Circle(0, 0, 0, 0, holeRadius, colors[4]), // Top Left
    new Circle(canvas.width, 0, 0, 0, holeRadius, colors[4]), // Top Right
    new Circle(0, canvas.height, 0, 0, holeRadius, colors[4]), // Bottom Left
    new Circle(canvas.width, canvas.height, 0, 0, holeRadius, colors[4]), // Bottom Right
  ];

  if (mouse.x === undefined || mouse.y === undefined) {
    mouse.x = Math.random() * canvas.width;
    mouse.y = Math.random() * canvas.height;
  }
  circleMouse = new Circle(mouse.x, mouse.y, 0, 0, 30, colors[0]);

  score = 0;
  scoreValueElement.textContent = score;
  isPaused = false;
  pauseOverlay.classList.remove("active");
  canvas.classList.remove("dimmed");
  pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
  bodyElement.classList.remove("paused");
}

function animate() {
  if (!isPaused) {
    requestAnimationFrame(animate);
    c.clearRect(0, 0, canvas.width, canvas.height);

    holes.forEach((hole) => hole.draw());
    circleObject.update();
    circleMouse.mouseUpdate();
  }
}

// NEW: Main initialization logic for the page load
function init() {
  if (!hasPlayedBefore) {
    // Show instructions
    instructionOverlay.classList.add("active");
    bodyElement.classList.add("paused"); // NEW: Add 'paused' class to show cursor
    scoreContainer.style.display = "none"; // Hide score UI
    isPaused = true; // Ensure game is paused or not yet started

    startGameButton.addEventListener(
      "click",
      () => {
        instructionOverlay.classList.remove("active");
        // The 'paused' class will be removed by setupGame() implicitly
        // when it sets isPaused to false and updates the body class.
        scoreContainer.style.display = "flex"; // Show score UI
        sessionStorage.setItem("hasPlayedGame", "true");
        hasPlayedBefore = true; // Update in-memory flag
        setupGame(); // Setup game elements
        animate(); // Start the game loop
      },
      { once: true }
    ); // Listener only fires once
  } else {
    // If already played, just start the game immediately
    instructionOverlay.classList.remove("active"); // Ensure it's hidden
    scoreContainer.style.display = "flex"; // Ensure score UI is visible
    setupGame(); // Setup game elements (which removes 'paused' class)
    animate(); // Start the game loop
  }
}

// Initial call to the main init function when the script loads
init();
