// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Holds all logic for Player entity in
 * the iap-hello-world game.
 * @author dhermes@google.com (Daniel Hermes)
 * Requires jQuery, Sprite.js
 */

/**
 * Defines basic attributes of player entity
 * @param {number} x Starting x position of player.
 * @param {number} y Starting y position of player.
 * @param {string} sprite Name of file in images/ with sprite img.
 * @constructor
 */
function Player(x, y, sprite) {
  this.x = x;
  this.y = y;
  this.freefall = false;
  this.facing = 'right';
  // library sprite.js must be included
  this.sprite = Sprite(sprite);
}

/**
 * Changes canvas input by drawing Player (using sprite.js)
 * @param {object:CanvasRenderingContext2D} canvas 2DCanvas object
 *     for drawing game.
 */
Player.prototype.draw = function(canvas) {
  this.sprite.draw(canvas, this.x, this.y);
};

/**
 * Helper function to determine row occupied by player.
 * @param {number} canvasHeight Height of canvas.
 * @param {number} size Width/height of player and blocks.
 * @return {number} Row player occupies if player is in a row, else -1.
 * @private
 */
Player.prototype.row_ = function(canvasHeight, size) {
  if ((canvasHeight - (this.y + size)) % size != 0) {
    // Returns -1 if not in a row
    return -1;
  } else {
    return (canvasHeight - (this.y + size)) / size;
  }
};

/**
 * Helper function to determine next column player will step into.
 * @param {number} size Width/height of player and blocks.
 * @param {number} stepSize Size of player "footstep".
 * @return {number} Column player will end up in upon stepping to the
 *     this.facing. If this.facing is neither left nor right, will not
 *     return a value.
 * @private
 */
Player.prototype.nextColumn_ = function(size, stepSize) {
  /* Returns the column that the end at this.facing will end up in
     after moving stepSize in that direction */
  if (this.facing == 'left') {
    return Math.floor((this.x - stepSize) / size);
  } else if (this.facing == 'right') {
    return Math.ceil((this.x + stepSize) / size);
  } else {
    console.log('Exiting nextColumn. Direction ' +
                this.facing +
                ' is not defined.');
    return;
  }
};

/**
 * Function to allow player to take a step (if possible).
 * @param {string} direction Direction player should step (sets variable).
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {object} constants Remaining constants defining surrounding game.
 */
Player.prototype.step = function(direction, staticBlocks, 
                                 moveBlocks, constants) {
  this.facing = direction;
  var size = constants.entitySize,
      stepSize = constants.stepSize;

  var row = this.row_(constants.canvasHeight, size);
  if (row == -1) {
    // Player not in a row, error
    return;
  }

  var currColumn = this.nextColumn_(size, 0),
      newColumn = this.nextColumn_(size, stepSize);

  if (currColumn == newColumn) {
    this.x += (direction == 'left') ? -stepSize : stepSize;
  } else {
    /* Need to check if newColumn has a block in the way or is a ledge
       player will fall off; a block can both be in the way of the player
       or his (optional) cargo */
    var staticIndex = $.inArray(row, staticBlocks[newColumn] || []),
        moveIndex = $.inArray(row, moveBlocks[newColumn] || []),
        // We don't allow moveBlocks to hover
        aboveStaticIndex = $.inArray(row + 1,
                                     staticBlocks[newColumn] || []);
    if (staticIndex != -1 || moveIndex != -1 ||
        (typeof this.block != 'undefined' && aboveStaticIndex != -1)) {
      /* There is either a static or moveable block in the way, or a
         static block above to be bumped into
         So we get right up next to it in our column */
      this.x = currColumn * size;
    } else {
      // If we are on the base row, there is no gravity
      if (row == constants.baseBlocks) {
        this.x += (direction == 'left') ? -stepSize : stepSize;
      } else {
        staticIndex = $.inArray(row - 1, staticBlocks[newColumn] || []);
        moveIndex = $.inArray(row - 1, moveBlocks[newColumn] || []);
        if (staticIndex != -1 || moveIndex != -1) {
          this.x += (direction == 'left') ? -stepSize : stepSize;
        } else {
          // If no blocks below, we are in freefall
          this.x = newColumn * size;
          this.freefall = true;
        }
      }
    }
  }

  if (this.x < 0) {
    this.x = 0;
  } else if (this.x + size > constants.canvasWidth) {
    this.x = constants.canvasWidth - size;
  }

  // Account for a block on head
  if (typeof this.block != 'undefined') {
    this.block.x = this.x;
  }
};

/**
 * Function to allow player to fall (until landing)
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {object} constants Remaining constants defining surrounding game.
 */
Player.prototype.fall = function(staticBlocks, moveBlocks, constants) {
  /* We only allow objects to fall when perfectly aligned with a column.
     This greatly simplifies gravity */
  var size = constants.entitySize;
  if (this.x % size != 0) {
    /* Player not in a in a column, this should never occur since step
       should place the falling player precisely in a column */
    console.log('Player not in a column when fall called');
    return;
  }

  var column = this.x / size,
      // Coordinate system from top left
      footLocation = constants.canvasHeight - (this.y + size),
      destinationRow = Math.floor(
      (footLocation - constants.stepSize) / size);

  if (destinationRow < constants.baseBlocks) {
    this.y = constants.canvasHeight - size - constants.baseBlocks * size;
    this.freefall = false;
  } else {
    var staticIndex = $.inArray(destinationRow, staticBlocks[column] || []),
        moveIndex = $.inArray(destinationRow, moveBlocks[column] || []);
    if (staticIndex != -1 || moveIndex != -1) {
      this.y = constants.canvasHeight - size -
               (destinationRow + 1) * size;
      this.freefall = false;
    } else {
      this.y += constants.stepSize;
    }
  }

  // Account for a block on head
  if (typeof this.block != 'undefined') {
    this.block.y = this.y - size;
  }
};

/**
 * Helper function to determine if player can jump
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {number} size Width/height of player and blocks.
 * @param {number} canvasHeight Height of canvas.
 * @return {object:array} Array containing [bool, row, column] where bool is
 *     true if player can jump and false otherwise and row, column represent the
 *     location the player can jump to.
 * @private
 */
Player.prototype.canJump_ = function(staticBlocks, moveBlocks,
                                     size, canvasHeight) {
  /* For jump to occur, we require
     1. player is directly next to the block (row, column)
     2. block has no block on top of it
     3. player is facing the block
     4. there is no block directly above the player
     5. there is no block above the new space the player will occupy */

  var row = this.row_(canvasHeight, size);
  if (row == -1) {
    // Player not aligned in a row
    return [false, -1, -1];
  }

  if (this.x % size != 0) {
    /* Player can't possibly be directly next to a block, hence can't
       jump on it this satisfies 1. */
    return [false, -1, -1];
  }
  var currColumn = this.x / size,
      // This satisfies 3.
      blockColumn = currColumn + ((this.facing == 'left') ? -1 : 1);

  // only static blocks can hover
  var aboveIndex = $.inArray(row + 1, staticBlocks[currColumn] || []);
  if (aboveIndex != -1) {
    /* Player can't possibly be directly below a block,
       this satisfies 4. */
    return [false, -1, -1];
  }

  // Check if a block is in the desired column
  var indexMove = $.inArray(row, moveBlocks[blockColumn] || []),
      indexStatic = $.inArray(row, staticBlocks[blockColumn] || []);
  if (indexMove == -1 && indexStatic == -1) {
    // no block, can't jump there
    return [false, -1, -1];
  } else {
    // This satisfies 2.
    var aboveIndexMove = $.inArray(row + 1, moveBlocks[blockColumn] || []),
        aboveIndexStatic = $.inArray(row + 1,
                                     staticBlocks[blockColumn] || []),
        // This satisfies 5.
        // We don't allow moveBlocks to hover
        aboveTwoIndexStatic = $.inArray(row + 2,
                                        staticBlocks[blockColumn] || []);
    if (aboveIndexMove != -1 || aboveIndexStatic != -1 ||
      (typeof this.block != 'undefined' &&
       aboveTwoIndexStatic != -1)) {
      return [false, -1, -1];
    } else {
      return [true, row, blockColumn];
    }
  }
};

/**
 * Function to allow player to jump (if possible).
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {object} constants Remaining constants defining surrounding game.
 */
Player.prototype.jump = function(staticBlocks, moveBlocks, constants) {
  /* -Responsibility for updating the moveBlocks object is delegated to the
      Block.fall function
     -When the block is putdown, it is still the property of player. The
      soloFreefall bit is set on the block and it will release itself from
      player when it hits hard surface */
  var valid = this.canJump_(staticBlocks, moveBlocks,
                            constants.entitySize, constants.canvasHeight);
  if (valid[0]) {
    var row = valid[1],
        column = valid[2];

    this.x = column * constants.entitySize;
    // Need to get on top of the block
    this.y = constants.canvasHeight - (row + 2) * constants.entitySize;

    if (typeof this.block != 'undefined') {
      this.block.x = this.x;
      // Coordinate system from top left
      this.block.y = this.y - constants.entitySize;
    }
  }
};

/**
 * Helper function to determine if player can pick up any block
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {number} size Width/height of player and blocks.
 * @param {number} canvasHeight Height of canvas.
 * @return {object:array} Array containing [bool, row, column] where bool is
 *     true if player can pick up any block and false otherwise and row, column
 *     represent the location of the block to be be picked up.
 * @private
 */
Player.prototype.canPickup_ = function(staticBlocks, moveBlocks,
                                       size, canvasHeight) {
  /* For pickup to occur, we require
     1. player is not already holding a block
     2. player is directly next to the block
     3. player is facing the block
     4. block has no block on top of it
     5. player has no block directly above him */
  if (typeof this.block != 'undefined') {
    // Player already holding a block, satisfies 1.
    return [false, -1, -1];
  }

  var row = this.row_(canvasHeight, size);
  if (row == -1) {
    // Player not aligned in a row
    return [false, -1, -1];
  }

  if (this.x % size != 0) {
    /* Player can't possibly be directly next to
       a stationary block, hence can't pick one up;
       this satisfies 2. */
    return [false, -1, -1];
  }
  var currColumn = this.x / size;

  /* Check if block above player (only static blocks can hover)
     This satisfies 5. */
  var abovePlayerIndex = $.inArray(row + 1, staticBlocks[currColumn] || []);
  if (abovePlayerIndex != -1) {
    return [false, -1, -1];
  }

  // This satisfies 3.
  var blockColumn = currColumn + ((this.facing == 'left') ? -1 : 1);

  // First check if a moveable block is in the desired column
  var index = $.inArray(row, moveBlocks[blockColumn] || []);
  if (index == -1) {
    return [false, -1, -1];
  } else {
    // If so, check if there are any blocks above the one we want to pickup
    var aboveIndexMove = $.inArray(row + 1, moveBlocks[blockColumn] || []),
        aboveIndexStatic = $.inArray(row + 1,
                                     staticBlocks[blockColumn] || []);
    if (aboveIndexMove == -1 && aboveIndexStatic == -1) {
      // This satisfies 4.
      return [true, row, blockColumn];
    } else {
      return [false, -1, -1];
    }
  }
};

/**
 * Function to allow player to pick up a block (if possible).
 * @param {object:array} blocks Array of all block entities in game.
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {object} constants Remaining constants defining surrounding game.
 */
Player.prototype.pickup = function(blocks, staticBlocks,
                                   moveBlocks, constants) {
  var valid = this.canPickup_(staticBlocks, moveBlocks,
                              constants.entitySize, constants.canvasHeight);
  if (valid[0]) {
    var row = valid[1],
        column = valid[2];

    // Find the block
    var foundBlock;
    $.each(blocks, function(index, block) {
      if (!block.static && block.row == row && block.column == column) {
        foundBlock = block;
      }
    });

    if (typeof foundBlock == 'undefined') {
      console.log('Error. No match to pick up.');
      return;
    }

    foundBlock.x = this.x;
    // Sits on top; Coordinate system from top left
    foundBlock.y = this.y - constants.entitySize;
    this.block = foundBlock;

    var index = $.inArray(row, moveBlocks[column] || []);
    if (index == -1) {
      console.log('Exiting step. Direction ' +
                  player.facing +
                  ' is not defined.');
      return;
    }
    moveBlocks[column].splice(index, 1);
  }
};

/**
 * Helper function to determine if player can put down block
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {number} size Width/height of player and blocks.
 * @param {number} canvasHeight Height of canvas.
 * @param {number} canvasWidth Width of canvas.
 * @return {object:array} Array containing [bool, row, column] where bool is
 *     true if player can put down a block, false otherwise and row, column
 *     represent the location where the block can be put down.
 * @private
 */
Player.prototype.canPutdown_ = function(staticBlocks, moveBlocks, size,
                                        canvasHeight, canvasWidth) {
  /* For putdown to occur, we require
     1. player is already holding a block
     2. player is aligned in a row
     3. the space where the block can land is not occupied
     4. the space above where the block can land is not occupied
     NOTE it is not required that a player be aligned in a column, if this
     does not hold, we will put it in the nearest full column if it is open */
  if (typeof this.block == 'undefined') {
    // Player not holding a block, satisfies 1.
    return [false, -1, -1];
  }

  var row = this.row_(canvasHeight, size);
  if (row == -1) {
    // Player not holding a block, satisfies 2.
    return [false, -1, -1];
  }

  var targetColumn = this.nextColumn_(size, size);
  if (targetColumn < 0 || targetColumn * size >= canvasWidth) {
    // targetColumn out of bounds
    return [false, -1, -1];
  }

  // Check if there is a block in the way
  var indexMove = $.inArray(row, moveBlocks[targetColumn] || []),
      indexStatic = $.inArray(row, staticBlocks[targetColumn] || []);
  if (indexMove != -1 || indexStatic != -1) {
    return [false, -1, -1];
  } else {
    /* This satisfies 3. Remains to check if destination will be covered
       (only static blocks can hover) */
    var aboveIndexStatic = $.inArray(row + 1,
                                     staticBlocks[targetColumn] || []);
    if (aboveIndexStatic != -1) {
      return [false, -1, -1];
    } else {
      // satisfies 4.
      return [true, row, targetColumn];
    }
  }
};

/**
 * Function to allow player to put down a block (if possible).
 * @param {object} staticBlocks Associative array of all static blocks in game.
 * @param {object} moveBlocks Associative array of all (fixed) moveable
 *     blocks in game.
 * @param {object} constants Remaining constants defining surrounding game.
 */
Player.prototype.putdown = function(staticBlocks, moveBlocks, constants) {
  /* -Responsibility for updating the moveBlocks object is delegated to
      the Block.fall function
     -When the block is putdown, it is still the property of player. The
      soloFreefall bit is set on the block and it will release itself from
      player when it hits hard surface */
  var valid = this.canPutdown_(staticBlocks, moveBlocks, constants.entitySize,
                               constants.canvasHeight, constants.canvasWidth);
  if (valid[0]) {
    var row = valid[1],
        column = valid[2];

    this.block.soloFreefall = true;
    this.block.x = column * constants.entitySize;
    this.block.y = constants.canvasHeight -
                   (row + 1) * constants.entitySize;
  }
};

/**
 * Function to determine if player has reached door.
 * @param {object} door Associative array holding row/column location of door.
 * @param {object} constants Remaining constants defining surrounding game.
 * @return {boolean} True if player has reached the door, false o.w.
 */
Player.prototype.reached = function(door, constants) {
  var xDisplace = Math.abs(this.x - door.column * constants.entitySize),
      yDisplace = Math.abs(this.y + constants.entitySize +
                           door.row * constants.entitySize -
                           constants.canvasHeight);
  return (xDisplace < constants.stepSize && yDisplace == 0);
};
