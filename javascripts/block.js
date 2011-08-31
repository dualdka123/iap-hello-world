// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Holds all logic for Block entity in
 * the iap-hello-world game.
 * @author dhermes@google.com (Daniel Hermes)
 * Requires jQuery
 */

var STATIC_COLORS = ['#3369E8',  // BLUE
                     '#D50F25',  // RED
                     '#009925']; // GREEN

/**
 * Defines basic attributes of block entity
 * @param {boolean} isStatic For constructor, denotes if block can be picked up.
 * @param {number} row Starting row of block.
 * @param {number} column Starting column of block.
 * @param {number} size Size of block (since square, this is just side length).
 * @param {number} canvasHeight (For drawing purposes) height of canvas.
 * @constructor
 */
function Block(isStatic, row, column, size, canvasHeight) {
  this.soloFreefall = false;
  this.row = row;
  this.column = column;
  this.static = isStatic;
  this.size = size;

  if (this.static) {
    this.color = STATIC_COLORS[(this.row + this.column) % 3];
  } else {
    this.color = '#EEB211'; // YELLOW
  }

  this.x = size * this.column;
  this.y = canvasHeight - (this.row + 1) * size;
}

/**
 * Changes canvas input by drawing Block
 * @param {object:CanvasRenderingContext2D} canvas 2DCanvas object
 *     for drawing game.
 */
Block.prototype.draw = function(canvas) {
  canvas.fillStyle = this.color;
  canvas.fillRect(this.x, this.y, this.size, this.size);
  canvas.strokeStyle = '#000'; // BLACK
  canvas.strokeRect(this.x, this.y, this.size, this.size);
};

/**
 * Changes player position by simulating gravity.
 * @param {object:Player} player 2DCanvas object for drawing game.
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {object} constants Remaining constants defining surrounding game.
 */
Block.prototype.fall = function(player, staticBlocks, moveBlocks, constants) {
  /* We only allow objects to fall when perfectly aligned with a column.
     This greatly simplifies gravity */
  if (this.x % this.size != 0) {
    // Block not in a in a column
    console.log('Block not in a column when fall called');
    return;
  }

  var column = this.x / this.size,
    // Coordinate system from top left
    bottomLocation = constants.canvasHeight - (this.y + this.size),
    destinationRow = Math.floor(
        (bottomLocation - constants.stepSize) / this.size);

  if (destinationRow < constants.baseBlocks) {
    this.y = constants.canvasHeight - this.size -
             constants.baseBlocks * this.size;
    this.soloFreefall = false;
  } else {
    var staticIndex = $.inArray(destinationRow, staticBlocks[column] || []),
        moveIndex = $.inArray(destinationRow, moveBlocks[column] || []);
    if (staticIndex != -1 || moveIndex != -1) {
      this.y = constants.canvasHeight - this.size -
               (destinationRow + 1) * this.size;
      this.soloFreefall = false;
    } else {
      this.y += constants.stepSize;
    }
  }

  if (!this.soloFreefall) {
    delete player.block;

    this.row = destinationRow + 1;
    this.column = column;

    if (column in moveBlocks) {
      moveBlocks[column].push(destinationRow + 1);
    } else {
      moveBlocks[column] = [destinationRow + 1];
    }
  }
};
