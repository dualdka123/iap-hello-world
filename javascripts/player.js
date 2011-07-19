function Player(x, y, sprite) {
    this.x = x;
    this.y = y;
    this.freefall = false;
    this.facing = "right";
    this.sprite = Sprite(sprite);
};

Player.prototype.draw = function(canvas) {
    this.sprite.draw(canvas, this.x, this.y);
};

Player.prototype.row = function(canvas_height, size) {
    if ((canvas_height - (this.y + size)) % size != 0) {
        // Returns -1 if not in a row
        return -1;
    } else {
        return (canvas_height - (this.y + size))/size;
    }
};

Player.prototype.next_column = function(size, step_size) {
    /* Returns the column that the end at this.facing will end up in
       after moving step_size in that direction */
    if (this.facing == "left") {
        return Math.floor((this.x - step_size)/size);
    } else if (this.facing == "right") {
        return Math.ceil((this.x + step_size)/size);
    } else {
        console.log("Exiting next_column. Direction " + this.facing + " is not defined.");
        return;
    }
};

Player.prototype.step = function(direction, static_blocks, move_blocks, constants) {
    this.facing = direction;
    var size = constants.entity_size;

    var row = this.row(constants.canvas_height, size);
    if (row == -1) {
        // Player not in a row, error
        return;
    }

    var curr_column = this.next_column(size, 0);
    var new_column = this.next_column(size, constants.step_size);

    if (curr_column == new_column) {    
        this.x += (direction == "left") ? -10 : 10;
    } else {
        /* Need to check if new_column has a block in the way or is a ledge player will fall off;
           a block can both be in the way of the player or his (optional) cargo */

        var static_index = $.inArray(row, static_blocks[new_column]);
        var move_index = $.inArray(row, move_blocks[new_column]);
        var above_static_index = $.inArray(row + 1, static_blocks[new_column]); // We don't allow move_blocks to hover
        if (static_index != -1 || move_index != -1 || (typeof this.block != "undefined" && above_static_index != -1 )) {
            // There is either a static or moveable block in the way, or a static block above to be bumped into
            // So we get right up next to it in our column
            this.x = curr_column*size;
        } else {
            // If we are on the base row, there is no gravity
            if (row == constants.base_blocks) {
                this.x += (direction == "left") ? -10 : 10;
            } else {
                static_index = $.inArray(row - 1, static_blocks[new_column]);
                move_index = $.inArray(row - 1, move_blocks[new_column]);
                if (static_index != -1 || move_index != -1) {
                    this.x += (direction == "left") ? -10 : 10;
                } else {
                    // If no blocks below, we are in freefall
                    this.x = new_column*size;
                    this.freefall = true;
                }
            }
        }
    }

    if (this.x < 0) {
        this.x = 0;
    } else if (this.x + size > constants.canvas_width) {
        this.x = constants.canvas_width - size;
    }

    // Account for a block on head
    if (typeof this.block != "undefined") {
        this.block.x = this.x;
    }
};

Player.prototype.fall = function(static_blocks, move_blocks, constants) {
    // We only allow objects to fall when perfectly aligned with a column
    // This greatly simplifies gravity
    var size = constants.entity_size;
    if (this.x % size != 0) {
        /* Player not in a in a column, this should never occur since step
           should place the falling player precisely in a column */
        console.log("Player not in a column when fall called");
        return;
    }

    var column = this.x/size;
    var foot_location = constants.canvas_height - (this.y + size); // Coordinate system from top left
    var destination_row = Math.floor((foot_location - constants.step_size)/size);

    if (destination_row < constants.base_blocks) {
        this.y = constants.canvas_height - size - constants.base_blocks*size;
        this.freefall = false;
    } else {
        var static_index = $.inArray(destination_row, static_blocks[column]);
        var move_index = $.inArray(destination_row, move_blocks[column]);
        if (static_index != -1 || move_index != -1) {
            this.y = constants.canvas_height - size - (destination_row + 1)*size;
            this.freefall = false;
        } else {
            this.y += constants.step_size;
        }
    }

    // Account for a block on head
    if (typeof this.block != "undefined") {
        this.block.y = this.y - size;
    }
};

Player.prototype.can_jump = function(static_blocks, move_blocks, size, canvas_height) {
    /* For jump to occur, we require
       1. player is directly next to the block (row, column)
       2. block has no block on top of it
       3. player is facing the block 
       4. there is no block directly above the player */

    var row = this.row(canvas_height, size);
    if (row == -1) {
        // Player not aligned in a row
        return [false, -1, -1];
    }

    if (this.x % size != 0) {
        /* Player can't possibly be directly next to a block, hence can't jump on it
           this satisfies 1. */
        return [false, -1, -1];
    }
    var curr_column = this.x/size;

    // This satisfies 3.
    var block_column = (this.facing == "left") ? (curr_column - 1) : (curr_column + 1);

    var above_index = $.inArray(row + 1, static_blocks[curr_column]); // only static blocks can hover
    if (above_index != -1) {
        /* Player can't possibly be directly below a block,
           this satisfies 4. */
        return [false, -1, -1];
    }

    // Check if a block is in the desired column
    var index_move = $.inArray(row, move_blocks[block_column]);
    var index_static = $.inArray(row, static_blocks[block_column]);
    if (index_move == -1 && index_static == -1) {
        // no block, can't jump there
        return [false, -1, -1];
    } else {
        // This satisfies 2.
        var above_index_move = $.inArray(row + 1, move_blocks[block_column]);
        var above_index_static = $.inArray(row + 1, static_blocks[block_column]);
        if (above_index_move == -1 && above_index_static == -1) {
            return [true, row, block_column];
        } else {
            return [false, -1, -1];
        }
    }
};

Player.prototype.jump = function(static_blocks, move_blocks, constants) {
    /* -Responsibility for updating the move_blocks object is delegated to the Block.fall function
       -When the block is putdown, it is still the property of player. The solo_freefall bit
        is set on the block and it will release itself from player when it hits hard surface */
    var valid = this.can_jump(static_blocks, move_blocks, constants.entity_size, constants.canvas_height);
    if (valid[0]) {
        var row = valid[1];
        var column = valid[2];

        this.x = column*constants.entity_size;
        this.y = constants.canvas_height - (row + 2)*constants.entity_size; // Need to get on top of the block

        if (typeof this.block != "undefined") {
            this.block.x = this.x;
            this.block.y = this.y - constants.entity_size; // Coordinate system from top left
        }
    }
};


Player.prototype.can_pickup = function(static_blocks, move_blocks, size, canvas_height) {
    /* For pickup to occur, we require
       1. player is not already holding a block
       2. player is directly next to the block
       3. player is facing the block
       4. block has no block on top of it 
       5. player has no block directly above him */

    if (typeof this.block != "undefined") {
        // Player already holding a block, satisfies 1.
        return [false, -1, -1];
    }

    var row = this.row(canvas_height, size);
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
    var curr_column = this.x/size;

    /* Check if block above player (only static blocks can hover)
       This satisfies 5. */
    var above_player_index = $.inArray(row + 1, static_blocks[curr_column]);
    if (above_player_index != -1) {
        return [false, -1, -1];
    }

    // This satisfies 3.
    var block_column = (this.facing == "left") ? (curr_column - 1) : (curr_column + 1);

    // First check if a moveable block is in the desired column
    var index = $.inArray(row, move_blocks[block_column]);
    if (index == -1) {
        return [false, -1, -1];
    } else {
        // If so, check if there are any blocks above the one we want to pickup
        var above_index_move = $.inArray(row + 1, move_blocks[block_column]);
        var above_index_static = $.inArray(row + 1, static_blocks[block_column]);
        if (above_index_move == -1 && above_index_static == -1) {
            // This satisfies 4.
            return [true, row, block_column];
        } else {
            return [false, -1, -1];
        }
    }
};

Player.prototype.pickup = function(blocks, static_blocks, move_blocks, constants) {
    var valid = this.can_pickup(static_blocks, move_blocks, constants.entity_size, constants.canvas_height);
    if (valid[0]) {
        var row = valid[1];
        var column = valid[2];

        // Find the block
        var found_block;
        $.each(blocks, function(index, block) {
            if (!block.static && block.row == row && block.column == column) {
                found_block = block;
            }
        });

        found_block.x = this.x;
        found_block.y = this.y - constants.entity_size; // Sits on top; Coordinate system from top left
        this.block = found_block;

        var index = $.inArray(row, move_blocks[column]);
        if (index == -1) {
            console.log("Exiting step. Direction " + player.facing + " is not defined.");
            return;
        }
        move_blocks[column].splice(index, 1);
    }
};

Player.prototype.can_putdown = function(static_blocks, move_blocks, size, canvas_height, canvas_width) {
    /* For putdown to occur, we require
       1. player is already holding a block
       2. player is aligned in a row
       3. the space where the block can land is not occupied 
       4. the space above where the block can land is not occupied 
       NOTE it is not required that a player be aligned in a column, if this
       does not hold, we will put it in the nearest full column if it is open */

    if (typeof this.block == "undefined") {
        // Player not holding a block, satisfies 1.
        return [false, -1, -1];
    }

    var row = this.row(canvas_height, size);
    if (row == -1) {
        // Player not holding a block, satisfies 2.
        return [false, -1, -1];
    }

    var target_column = this.next_column(size, size);
    if (target_column < 0 || target_column*size >= canvas_width) {
        // target_column out of bounds
        return [false, -1, -1];
    }

    // Check if there is a block in the way
    var index_move = $.inArray(row, move_blocks[target_column]);
    var index_static = $.inArray(row, static_blocks[target_column]);
    if (index_move != -1 || index_static != -1) {
        return [false, -1, -1];
    } else {
        // This satisfies 3. Remains to check if destination will be covered (only static blocks can hover)
        var above_index_static = $.inArray(row + 1, static_blocks[target_column]);
        if (above_index_static != -1) {
            return [false, -1, -1];
        } else {
            // satisfies 4.
            return [true, row, target_column];
        }
    }
};

Player.prototype.putdown = function(static_blocks, move_blocks, constants) {
    /* -Responsibility for updating the move_blocks object is delegated to the Block.fall function
       -When the block is putdown, it is still the property of player. The solo_freefall bit
        is set on the block and it will release itself from player when it hits hard surface */
    var valid = this.can_putdown(static_blocks, move_blocks, constants.entity_size, constants.canvas_height, constants.canvas_width);
    if (valid[0]) {
        var row = valid[1];
        var column = valid[2];

        this.block.solo_freefall = true;
        this.block.x = column*constants.entity_size;
        this.block.y = constants.canvas_height - (row + 1)*constants.entity_size;
    }
};

Player.prototype.reached = function(door, constants) {
    var x_displace = Math.abs(this.x - door.column*constants.entity_size);
    var y_displace = Math.abs(this.y + constants.entity_size + door.row*constants.entity_size - constants.canvas_height);
    return (x_displace < constants.step_size && y_displace == 0);
};
