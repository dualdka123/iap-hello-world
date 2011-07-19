var STATIC_COLORS = ["#3369E8",  // BLUE
                     "#D50F25",  // RED
                     "#009925"]; // GREEN

function Block(is_static, row, column, size, canvas_height) {
    this.solo_freefall = false;
    this.row = row;
    this.column = column;
    this.static = is_static;

    if (this.static) {
        this.color = STATIC_COLORS[(this.row + this.column) % 3];
    } else {
        this.color = "#EEB211"; // YELLOW
    }

    this.x = size*this.column;
    this.y = canvas_height - (this.row + 1)*size;
};

Block.prototype.draw = function(canvas, size) {
    canvas.fillStyle = this.color;
    canvas.fillRect(this.x, this.y, size, size);
    canvas.strokeStyle = "#000"; // BLACK
    canvas.strokeRect(this.x, this.y, size, size);
};

Block.prototype.fall = function(player, static_blocks, move_blocks, constants) {
    // We only allow objects to fall when perfectly aligned with a column
    // This greatly simplifies gravity
    var size = constants.entity_size;
    if (this.x % size != 0) {
        // Block not in a in a column
        console.log("Block not in a column when fall called");
        return;
    }

    var column = this.x/size;
    var bottom_location = constants.canvas_height - (this.y + size); // Coordinate system from top left
    var destination_row = Math.floor((bottom_location - constants.step_size)/size);

    if (destination_row < constants.base_blocks) {
        this.y = constants.canvas_height - size - constants.base_blocks*size;
        this.solo_freefall = false;
    } else {
        var static_index = $.inArray(destination_row, static_blocks[column]);
        var move_index = $.inArray(destination_row, move_blocks[column]);
        if (static_index != -1 || move_index != -1) {
            this.y = constants.canvas_height - size - (destination_row + 1)*size;
            this.solo_freefall = false;
        } else {
            this.y += constants.step_size;
        }
    }

    if (!this.solo_freefall) {
        delete player.block;
    
        this.row = destination_row + 1;
        this.column = column;

        if (column in move_blocks) {
            move_blocks[column].push(destination_row + 1);
        } else {
            move_blocks[column] = [destination_row + 1];
        }
    }
};
