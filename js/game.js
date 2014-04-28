var Setup = {
	
	width: 448,
	height: 448,
	stateChange: false,
	wait: 0,
	falling: false,
	landing: false,
	jumpPress: 0,
	cursors: {},
	currentLevel: [0,1],
	velocityX: -100,
	posX: 0,
	ladderCheck: 0,
	direciton: "left",
	didWin: false,
	walking: true,
	endCheck: 0,
	preload: function(){

		Game.load.image('title', '/games/noeyeswilly/assets/sprites/title.png');
		Game.load.spritesheet('btnPlay', '/games/noeyeswilly/assets/sprites/btn-play.png', 128, 64);
		Boot.preload();


	},
	create: function(){

		document.getElementById('loading').innerHTML = "";

		Game.add.sprite(0, 0, 'title');
		Game.add.button(Setup.width / 2 - 64, 100, 'btnPlay', Setup.startGame, this, 0, 0, 1, 0);

	},
	update: function(){

	},
	controls: function(){

		Game.input.onDown.add(Setup.click, this);

	},
	startGame: function(){

		Game.state.start("Level_0_0");

	},
	click: function(e){

		var data = Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].map.layers[0].data,
			distance = Game.math.distance(0, 0, Game.input.mousePointer.x, Game.input.mousePointer.y),
			currentTileX = Game.math.snapToFloor(Game.input.mousePointer.worldX, 32) / 32,
	    	currentTileY = Game.math.snapToFloor(Game.input.mousePointer.worldY, 32) / 32;

	    if(data[currentTileY][currentTileX] === null){
	    	try{

	    	} catch(e) {
	    		console.log("error");
	    	}
	    } else if (data[currentTileY][currentTileX].index === 19){
			Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].map.putTile(20, currentTileX, currentTileY);
			Game.sound.play("select");
	    } else {
	    	return false;
	    }

	},
	spriteTest: function(e, player){

		if(Player.body.velocity.x === -100){

			Setup.velocityX = 100;
		
		} else if(Player.body.velocity.x === 100){
		
			Setup.velocityX = -100;
		
		}

	},
	climbLadder: function(){

		if(Setup.ladderCheck < 1){

			Setup.posX = Player.body.x;
			
			if(Setup.velocityX === -100){
				Setup.direction = "left";
			} else {
				Setup.direction = "right";
			}

		}
	
		Setup.ladderCheck++;

		if(Player.body.x <= Setup.posX - 32 && Setup.direction === "left"){
			climb();
		} else if (Player.body.x >= Setup.posX + 32 && Setup.direction === "right") {
			climb();
		}

		function climb(){
			Setup.velocityX = 0;
			Player.body.velocity.y = -100;
			Setup.wasClimbing = true;
			Setup.walking = false;
			Player.animations.play('climb');
		}

	},
	climbingFinish: function(){

		if(Setup.wasClimbing){
			Setup.wasClimbing = false;
			Setup.velocityX = -100;
			Setup.ladderCheck = 0;
			Setup.walking = true;
		}

	},
	death: function(){
		
		Player.alive = false;

		setTimeout(function(){

			Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].emitter.x = Player.x;
		    Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].emitter.y = Player.y;
		    Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].emitter.start(true, 3000, null, 500);

			Player.kill();

			Setup.endScreen();

		}, 200);

	},
	endScreen: function(){

		if(Setup.endCheck < 1){

			if(!Player.alive){
				
				Game.sound.play("death");

				var skull = Game.add.sprite(Setup.width / 2 - 64, 60, 'skull');

				skull.fixedToCamera = true;

				Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].btnRetry = Game.add.button(Setup.width / 2 - 64, Setup.height / 2 + 40, 'btnRetry', Setup.retryLevel, this, 0, 0, 1, 0);
				Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].btnRetry.fixedToCamera = true;

			} else {

				Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].martha.animations.play('splash', 16, false);
				Game.sound.play("splash");

				var clean = Game.add.sprite(Setup.width / 2 - 64, 60, 'clean');

				clean.fixedToCamera = true;
				clean.animations.add('clean', [0,1], 2);
				clean.animations.play('clean', 2, false);

				if(Setup.currentLevel[1] === 7){

					Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].btnRestart = Game.add.button(Setup.width / 2 - 64, Setup.height / 2 + 40, 'btnRestart', Setup.restartGame, this, 0, 0, 1, 0);
					Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].btnRestart.fixedToCamera = true;

				} else {

					Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].btnNext = Game.add.button(Setup.width / 2 - 64, Setup.height / 2 + 40, 'btnNext', Setup.nextLevel, this, 0, 0, 1, 0);
					Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].btnNext.fixedToCamera = true;
				
					Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].btnRetry = Game.add.button(Setup.width / 2 - 64, Setup.height / 2 + 114, 'btnRetry', Setup.retryLevel, this, 0, 0, 1, 0);
					Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].btnRetry.fixedToCamera = true;
				
				}

				
				
				setTimeout(function(){
					Levels[Setup.currentLevel[0]][Setup.currentLevel[1]].martha.animations.frame = 0;
					Player.animations.play('dance');
					Game.sound.play("powerup");
				},500);
				
			}
			
		}
		
		Setup.endCheck++;
	
	},
	retryLevel: function(){

		var levelString = "Level_0_" + (Setup.currentLevel[1]);

		Setup.endCheck = 0;
		Game.state.start(levelString);

	},
	nextLevel: function(){

		var levelString = "Level_0_" + (Setup.currentLevel[1] + 1);

		Setup.endCheck = 0;
		Game.state.start(levelString);

	},
	restartGame: function(){
		
		Setup.endCheck = 0;
		Game.state.start("Level_0_0");

	}

};

var Game = new Phaser.Game(Setup.width, Setup.height, Phaser.AUTO, '', { preload: Setup.preload, create: Setup.create, update: Setup.update }, false, false, false);

// create a state generation loop based on levels.js
Game.state.add('Level_0_0', Levels[0][0], false);
Game.state.add('Level_0_1', Levels[0][1], false);
Game.state.add('Level_0_2', Levels[0][2], false);
Game.state.add('Level_0_3', Levels[0][3], false);
Game.state.add('Level_0_4', Levels[0][4], false);
Game.state.add('Level_0_5', Levels[0][5], false);
Game.state.add('Level_0_6', Levels[0][6], false);
Game.state.add('Level_0_7', Levels[0][7], false);