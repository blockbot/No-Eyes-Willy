var Levels = {
	preloadDetails: function(){

		Setup.didWin = false;
		Setup.walking = true;
		Setup.velocityX = 0;
		Setup.wait = 0;

	},
	0: {

	 	0: {
	 		map: null,
	 		cursors: {},
	 		replacements: {
	 			1: 3
	 		},
	 		preload: function(){

	 			Setup.currentLevel = [0,0];
	 			
	 			Game.load.tilemap('map', '/games/noeyeswilly/assets/tilemaps/test.json', null, Phaser.Tilemap.TILED_JSON);

	 			Levels.preloadDetails();

	 		},
	 		create: function(){

	 			this.map = Game.add.tilemap('map');
			    this.map.addTilesetImage("tiles", 'tiles');
			   	this.map.setCollisionBetween(1,18);
			   	this.map.setCollision(20);

			    this.layer = this.map.createLayer('Tile Layer 1');
			    this.layer.resizeWorld();

	    		Game.physics.startSystem(Phaser.Physics.ARCADE);

			    this.ladders = Game.add.group();
			    this.ladders.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 25, 'ladders', 0, true, false, this.ladders);

			    this.spikes = Game.add.group();
			    this.spikes.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 26, 'spikes', 0, true, false, this.spikes);

			    this.martha = Game.add.sprite(0, 0, "martha");
				this.martha.name = "martha";
			  	
			  	// Player = Game.add.sprite(128, 0, "willy");
			    Player = Game.add.sprite(448, Game.world.height - 96, "willy");
			    Player.name = "willy";
			    Player.anchor.setTo(.5,.5);

				this.explosion = Game.add.sprite(384, 320, "explosion");
				this.explosion.name = "explosion";

			    Game.physics.arcade.enable(this.martha);
			    Game.physics.arcade.enable(Player);
				
			    this.martha.body.immovable = true;
			    this.martha.animations.add('splash', [1,2,3,4], 5, true);

				Player.body.checkCollision.up = false;
				Player.inputEnabled = true;
			    Player.events.onInputDown.add(Setup.spriteTest, this);
			    Player.body.setSize(32, 64, 0, 0);
			    Player.body.gravity.y = 1000;
			    Player.body.collideWorldBounds = true;

			    Player.animations.add('walk', [2,3,2,4], 8, true);
		    	Player.animations.add('dance', [0,0,1,1], 8, true);
		    	Player.animations.add('climb', [5,5,6,6], 8, true);

		    	this.explosion.animations.add('explode', [0,1,2,3,4,5], 6, true);

			    this.emitter = Game.add.emitter(0, 0, 500);

			    this.emitter.makeParticles('blood');
			    this.emitter.gravity = 200;

			    Game.camera.follow(Player);

	 		},
	 		update: function(){

	 			if(Setup.wait < 1){

	 				Player.scale.x = -1; 
	 				this.explosion.animations.play('explode', 10, false);
	 				Game.sound.play("explosion");
	 				setTimeout(function(){
						Setup.velocityX = -100;
	 				}, 200);
	 			
	 			}

	 			Setup.wait++;

	 			Game.physics.arcade.collide(Player, this.martha, touchedMartha, null, this);
				Game.physics.arcade.collide(Player, this.layer);
	 			Game.physics.arcade.overlap(Player, this.ladders, Setup.climbLadder, null, this);
	 			Game.physics.arcade.overlap(Player, this.spikes, Setup.death, null, this);

				Setup.controls();

				Player.body.velocity.x = Setup.velocityX;

				if(Setup.walking){
					Player.animations.play('walk');
				}
				
				if(Player.body.blocked.left){
					Setup.velocityX = 100;
				} else if(Player.body.blocked.right){
					Setup.velocityX = -100;
				}

				if(Setup.velocityX === -100){
					Player.scale.x = -1; 
				} else if (Setup.velocityX === 100){
					Player.scale.x = 1; 
				}

				if(Game.physics.arcade.overlap(Player, this.ladders)){
					Setup.isClimbing = true;
				} else {
					Setup.isClimbing = false;
				}

				if(!Setup.isClimbing){
					Setup.climbingFinish();
				}

				function touchedMartha(){
					Setup.didWin = true;
					Setup.walking = false;

				}

				if(Setup.didWin){

					Setup.endScreen();

				}

				if(!Player.alive){
					Player.animations.stop();		
					Player.frame = 7;
					Setup.velocityX = 0;
					Player.body.velocity.y = 100;
				}

	 		}

	 	},
	 	1: {
	 		map: null,
	 		cursors: {},
	 		replacements: {
	 			1: 3
	 		},
	 		preload: function(){

	 			Setup.currentLevel = [0,1];

	 			Game.load.tilemap('map', '/games/noeyeswilly/assets/tilemaps/level0_1.json', null, Phaser.Tilemap.TILED_JSON);

	 			Levels.preloadDetails();

	 		},
	 		create: function(){

	 			this.map = Game.add.tilemap('map');
			    this.map.addTilesetImage("tiles", 'tiles');
			   	this.map.setCollisionBetween(1,18);
			   	this.map.setCollision(20);

			    this.layer = this.map.createLayer('Tile Layer 1');
			    this.layer.resizeWorld();

	    		Game.physics.startSystem(Phaser.Physics.ARCADE);

			    this.ladders = Game.add.group();
			    this.ladders.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 25, 'ladders', 0, true, false, this.ladders);

			    this.spikes = Game.add.group();
			    this.spikes.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 26, 'spikes', 0, true, false, this.spikes);

			    this.martha = Game.add.sprite(Game.world.width - 32, 160, "martha");
				this.martha.name = "martha";
			  	this.martha.anchor.setTo(.5,.5);
				this.martha.scale.x = -1; 

			  	// Player = Game.add.sprite(128, 0, "willy");
			    Player = Game.add.sprite(Game.world.width, Game.world.height - 96, "willy");
			    Player.name = "willy";
			    Player.anchor.setTo(.5,.5);

				this.explosion = Game.add.sprite(Game.world.width - 64, Game.world.height - 128, "explosion");
				this.explosion.name = "explosion";

			    Game.physics.arcade.enable(this.martha);
			    Game.physics.arcade.enable(Player);
				
			    this.martha.body.immovable = true;
			    this.martha.animations.add('splash', [1,2,3,4], 5, true);

				Player.body.checkCollision.up = false;
				Player.inputEnabled = true;
			    Player.events.onInputDown.add(Setup.spriteTest, this);
			    Player.body.setSize(32, 64, 0, 0);
			    Player.body.gravity.y = 1000;
			    Player.body.collideWorldBounds = true;

			    Player.animations.add('walk', [2,3,2,4], 8, true);
		    	Player.animations.add('dance', [0,0,1,1], 8, true);
		    	Player.animations.add('climb', [5,5,6,6], 8, true);

		    	this.explosion.animations.add('explode', [0,1,2,3,4,5], 6, true);

			    this.emitter = Game.add.emitter(0, 0, 500);

			    this.emitter.makeParticles('blood');
			    this.emitter.gravity = 200;

			    Game.camera.follow(Player);

	 		},
	 		update: function(){

	 			if(Setup.wait < 1){

	 				Player.scale.x = -1; 
	 				this.explosion.animations.play('explode', 10, false);
	 				Game.sound.play("explosion");

	 				setTimeout(function(){
						Setup.velocityX = -100;
	 				}, 200);
	 			
	 			}

	 			Setup.wait++;

	 			Game.physics.arcade.collide(Player, this.martha, touchedMartha, null, this);
				Game.physics.arcade.collide(Player, this.layer);
	 			Game.physics.arcade.overlap(Player, this.ladders, Setup.climbLadder, null, this);
	 			Game.physics.arcade.overlap(Player, this.spikes, Setup.death, null, this);

				Setup.controls();

				Player.body.velocity.x = Setup.velocityX;

				if(Setup.walking){
					Player.animations.play('walk');
				}
				
				if(Player.body.blocked.left){
					Setup.velocityX = 100;
				} else if(Player.body.blocked.right){
					Setup.velocityX = -100;
				}

				if(Setup.velocityX === -100){
					Player.scale.x = -1; 
				} else if (Setup.velocityX === 100){
					Player.scale.x = 1; 
				}

				if(Game.physics.arcade.overlap(Player, this.ladders)){
					Setup.isClimbing = true;
				} else {
					Setup.isClimbing = false;
				}

				if(!Setup.isClimbing){
					Setup.climbingFinish();
				}

				function touchedMartha(){
					Setup.didWin = true;
					Setup.walking = false;

				}

				if(Setup.didWin){

					Setup.endScreen();

				}

				if(!Player.alive){
					Player.animations.stop();		
					Player.frame = 7;
					Setup.velocityX = 0;
					Player.body.velocity.y = 100;
				}

	 		}

	 	},
	 	2: {
	 		map: null,
	 		cursors: {},
	 		replacements: {
	 			1: 3
	 		},
	 		preload: function(){

	 			Setup.currentLevel = [0,2];

	 			Game.load.tilemap('map', '/games/noeyeswilly/assets/tilemaps/level0_2.json', null, Phaser.Tilemap.TILED_JSON);

	 			Levels.preloadDetails();

	 		},
	 		create: function(){

	 			this.map = Game.add.tilemap('map');
			    this.map.addTilesetImage("tiles", 'tiles');
			   	this.map.setCollisionBetween(1,18);
			   	this.map.setCollision(20);

			    this.layer = this.map.createLayer('Tile Layer 1');
			    this.layer.resizeWorld();

	    		Game.physics.startSystem(Phaser.Physics.ARCADE);

			    this.ladders = Game.add.group();
			    this.ladders.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 25, 'ladders', 0, true, false, this.ladders);

			    this.spikes = Game.add.group();
			    this.spikes.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 26, 'spikes', 0, true, false, this.spikes);

			    this.martha = Game.add.sprite(Game.world.width - 32, Game.world.height - 64, "martha");
				this.martha.name = "martha";
			  	this.martha.anchor.setTo(.5,.5);
				this.martha.scale.x = -1; 

			  	// Player = Game.add.sprite(128, 0, "willy");
			    Player = Game.add.sprite(Game.world.width - 192, Game.world.height - 64, "willy");
			    Player.name = "willy";
			    Player.anchor.setTo(.5,.5);

				this.explosion = Game.add.sprite(Game.world.width - 256, Game.world.height - 96, "explosion");
				this.explosion.name = "explosion";

			    Game.physics.arcade.enable(this.martha);
			    Game.physics.arcade.enable(Player);
				
			    this.martha.body.immovable = true;
			    this.martha.animations.add('splash', [1,2,3,4], 5, true);

				Player.body.checkCollision.up = false;
				Player.inputEnabled = true;
			    Player.events.onInputDown.add(Setup.spriteTest, this);
			    Player.body.setSize(32, 64, 0, 0);
			    Player.body.gravity.y = 1000;
			    Player.body.collideWorldBounds = true;

			    Player.animations.add('walk', [2,3,2,4], 8, true);
		    	Player.animations.add('dance', [0,0,1,1], 8, true);
		    	Player.animations.add('climb', [5,5,6,6], 8, true);

		    	this.explosion.animations.add('explode', [0,1,2,3,4,5], 6, true);

			    this.emitter = Game.add.emitter(0, 0, 500);

			    this.emitter.makeParticles('blood');
			    this.emitter.gravity = 200;

			    Game.camera.follow(Player);

	 		},
	 		update: function(){

	 			if(Setup.wait < 1){

	 				Player.scale.x = -1; 
	 				this.explosion.animations.play('explode', 10, false);
	 				Game.sound.play("explosion");
	 				setTimeout(function(){
						Setup.velocityX = -100;
	 				}, 200);
	 			
	 			}

	 			Setup.wait++;

	 			Game.physics.arcade.collide(Player, this.martha, touchedMartha, null, this);
				Game.physics.arcade.collide(Player, this.layer);
	 			Game.physics.arcade.overlap(Player, this.ladders, Setup.climbLadder, null, this);
	 			Game.physics.arcade.overlap(Player, this.spikes, Setup.death, null, this);

				Setup.controls();

				Player.body.velocity.x = Setup.velocityX;

				if(Setup.walking){
					Player.animations.play('walk');
				}
				
				if(Player.body.blocked.left){
					Setup.velocityX = 100;
				} else if(Player.body.blocked.right){
					Setup.velocityX = -100;
				}

				if(Setup.velocityX === -100){
					Player.scale.x = -1; 
				} else if (Setup.velocityX === 100){
					Player.scale.x = 1; 
				}

				if(Game.physics.arcade.overlap(Player, this.ladders)){
					Setup.isClimbing = true;
				} else {
					Setup.isClimbing = false;
				}

				if(!Setup.isClimbing){
					Setup.climbingFinish();
				}

				function touchedMartha(){
					Setup.didWin = true;
					Setup.walking = false;

				}

				if(Setup.didWin){

					Setup.endScreen();

				}

				if(!Player.alive){
					Player.animations.stop();		
					Player.frame = 7;
					Setup.velocityX = 0;
					Player.body.velocity.y = 100;
				}

	 		}

	 	},
	 	3: {
	 		map: null,
	 		cursors: {},
	 		replacements: {
	 			1: 3
	 		},
	 		preload: function(){

	 			Setup.currentLevel = [0,3];

	 			Game.load.tilemap('map', '/games/noeyeswilly/assets/tilemaps/level0_3.json', null, Phaser.Tilemap.TILED_JSON);

	 			Levels.preloadDetails();

	 		},
	 		create: function(){

	 			this.map = Game.add.tilemap('map');
			    this.map.addTilesetImage("tiles", 'tiles');
			   	this.map.setCollisionBetween(1,18);
			   	this.map.setCollision(20);

			    this.layer = this.map.createLayer('Tile Layer 1');
			    this.layer.resizeWorld();

	    		Game.physics.startSystem(Phaser.Physics.ARCADE);

			    this.ladders = Game.add.group();
			    this.ladders.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 25, 'ladders', 0, true, false, this.ladders);

			    this.spikes = Game.add.group();
			    this.spikes.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 26, 'spikes', 0, true, false, this.spikes);

			    this.martha = Game.add.sprite(96, 32, "martha");
				this.martha.name = "martha";
			  	this.martha.anchor.setTo(.5,.5);
				this.martha.scale.x = -1; 

			  	// Player = Game.add.sprite(128, 0, "willy");
			    Player = Game.add.sprite(Game.world.width, 0, "willy");
			    Player.name = "willy";
			    Player.anchor.setTo(.5,.5);

				this.explosion = Game.add.sprite(Game.world.width - 64, 0, "explosion");
				this.explosion.name = "explosion";

			    Game.physics.arcade.enable(this.martha);
			    Game.physics.arcade.enable(Player);
				
			    this.martha.body.immovable = true;
			    this.martha.animations.add('splash', [1,2,3,4], 5, true);

				Player.body.checkCollision.up = false;
				Player.inputEnabled = true;
			    Player.events.onInputDown.add(Setup.spriteTest, this);
			    Player.body.setSize(32, 64, 0, 0);
			    Player.body.gravity.y = 1000;
			    Player.body.collideWorldBounds = true;

			    Player.animations.add('walk', [2,3,2,4], 8, true);
		    	Player.animations.add('dance', [0,0,1,1], 8, true);
		    	Player.animations.add('climb', [5,5,6,6], 8, true);

		    	this.explosion.animations.add('explode', [0,1,2,3,4,5], 6, true);

			    this.emitter = Game.add.emitter(0, 0, 500);

			    this.emitter.makeParticles('blood');
			    this.emitter.gravity = 200;

			    Game.camera.follow(Player);

	 		},
	 		update: function(){

	 			if(Setup.wait < 1){

	 				Player.scale.x = -1; 
	 				this.explosion.animations.play('explode', 10, false);
	 				Game.sound.play("explosion");
	 				setTimeout(function(){
						Setup.velocityX = -100;
	 				}, 200);
	 			
	 			}

	 			Setup.wait++;

	 			Game.physics.arcade.collide(Player, this.martha, touchedMartha, null, this);
				Game.physics.arcade.collide(Player, this.layer);
	 			Game.physics.arcade.overlap(Player, this.ladders, Setup.climbLadder, null, this);
	 			Game.physics.arcade.overlap(Player, this.spikes, Setup.death, null, this);

				Setup.controls();

				Player.body.velocity.x = Setup.velocityX;

				if(Setup.walking){
					Player.animations.play('walk');
				}
				
				if(Player.body.blocked.left){
					Setup.velocityX = 100;
				} else if(Player.body.blocked.right){
					Setup.velocityX = -100;
				}

				if(Setup.velocityX === -100){
					Player.scale.x = -1; 
				} else if (Setup.velocityX === 100){
					Player.scale.x = 1; 
				}

				if(Game.physics.arcade.overlap(Player, this.ladders)){
					Setup.isClimbing = true;
				} else {
					Setup.isClimbing = false;
				}

				if(!Setup.isClimbing){
					Setup.climbingFinish();
				}

				function touchedMartha(){
					Setup.didWin = true;
					Setup.walking = false;

				}

				if(Setup.didWin){

					Setup.endScreen();

				}

				if(!Player.alive){
					Player.animations.stop();		
					Player.frame = 7;
					Setup.velocityX = 0;
					Player.body.velocity.y = 100;
				}

	 		}

	 	},
	 	4: {
	 		map: null,
	 		cursors: {},
	 		replacements: {
	 			1: 3
	 		},
	 		preload: function(){

	 			Setup.currentLevel = [0,4];

	 			Game.load.tilemap('map', '/games/noeyeswilly/assets/tilemaps/level0_4.json', null, Phaser.Tilemap.TILED_JSON);

	 			Levels.preloadDetails();

	 		},
	 		create: function(){

	 			this.map = Game.add.tilemap('map');
			    this.map.addTilesetImage("tiles", 'tiles');
			   	this.map.setCollisionBetween(1,18);
			   	this.map.setCollision(20);

			    this.layer = this.map.createLayer('Tile Layer 1');
			    this.layer.resizeWorld();

	    		Game.physics.startSystem(Phaser.Physics.ARCADE);

			    this.ladders = Game.add.group();
			    this.ladders.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 25, 'ladders', 0, true, false, this.ladders);

			    this.spikes = Game.add.group();
			    this.spikes.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 26, 'spikes', 0, true, false, this.spikes);

			    this.martha = Game.add.sprite(Game.world.width - 382, Game.world.height - 64, "martha");
				this.martha.name = "martha";
			  	this.martha.anchor.setTo(.5,.5);
				this.martha.scale.x = -1; 

			  	// Player = Game.add.sprite(128, 0, "willy");
			    Player = Game.add.sprite(Game.world.width , Game.world.height - 64, "willy");
			    Player.name = "willy";
			    Player.anchor.setTo(.5,.5);

				this.explosion = Game.add.sprite(Game.world.width - 64, Game.world.height - 96, "explosion");
				this.explosion.name = "explosion";

			    Game.physics.arcade.enable(this.martha);
			    Game.physics.arcade.enable(Player);
				
			    this.martha.body.immovable = true;
			    this.martha.animations.add('splash', [1,2,3,4], 5, true);

				Player.body.checkCollision.up = false;
				Player.inputEnabled = true;
			    Player.events.onInputDown.add(Setup.spriteTest, this);
			    Player.body.setSize(32, 64, 0, 0);
			    Player.body.gravity.y = 1000;
			    Player.body.collideWorldBounds = true;

			    Player.animations.add('walk', [2,3,2,4], 8, true);
		    	Player.animations.add('dance', [0,0,1,1], 8, true);
		    	Player.animations.add('climb', [5,5,6,6], 8, true);

		    	this.explosion.animations.add('explode', [0,1,2,3,4,5], 6, true);

			    this.emitter = Game.add.emitter(0, 0, 500);

			    this.emitter.makeParticles('blood');
			    this.emitter.gravity = 200;

			    Game.camera.follow(Player);

	 		},
	 		update: function(){

	 			if(Setup.wait < 1){

	 				Player.scale.x = -1; 
	 				this.explosion.animations.play('explode', 10, false);
	 				Game.sound.play("explosion");
	 				setTimeout(function(){
						Setup.velocityX = -100;
	 				}, 200);
	 			
	 			}

	 			Setup.wait++;

	 			Game.physics.arcade.collide(Player, this.martha, touchedMartha, null, this);
				Game.physics.arcade.collide(Player, this.layer);
	 			Game.physics.arcade.overlap(Player, this.ladders, Setup.climbLadder, null, this);
	 			Game.physics.arcade.overlap(Player, this.spikes, Setup.death, null, this);

				Setup.controls();

				Player.body.velocity.x = Setup.velocityX;

				if(Setup.walking){
					Player.animations.play('walk');
				}
				
				if(Player.body.blocked.left){
					Setup.velocityX = 100;
				} else if(Player.body.blocked.right){
					Setup.velocityX = -100;
				}

				if(Setup.velocityX === -100){
					Player.scale.x = -1; 
				} else if (Setup.velocityX === 100){
					Player.scale.x = 1; 
				}

				if(Game.physics.arcade.overlap(Player, this.ladders)){
					Setup.isClimbing = true;
				} else {
					Setup.isClimbing = false;
				}

				if(!Setup.isClimbing){
					Setup.climbingFinish();
				}

				function touchedMartha(){
					Setup.didWin = true;
					Setup.walking = false;

				}

				if(Setup.didWin){

					Setup.endScreen();

				}

				if(!Player.alive){
					Player.animations.stop();		
					Player.frame = 7;
					Setup.velocityX = 0;
					Player.body.velocity.y = 100;
				}

	 		}

	 	},
	 	5: {
	 		map: null,
	 		cursors: {},
	 		replacements: {
	 			1: 3
	 		},
	 		preload: function(){

	 			Setup.currentLevel = [0,5];

	 			Game.load.tilemap('map', '/games/noeyeswilly/assets/tilemaps/level0_5.json', null, Phaser.Tilemap.TILED_JSON);

	 			Levels.preloadDetails();

	 		},
	 		create: function(){

	 			this.map = Game.add.tilemap('map');
			    this.map.addTilesetImage("tiles", 'tiles');
			   	this.map.setCollisionBetween(1,18);
			   	this.map.setCollision(20);

			    this.layer = this.map.createLayer('Tile Layer 1');
			    this.layer.resizeWorld();

	    		Game.physics.startSystem(Phaser.Physics.ARCADE);

			    this.ladders = Game.add.group();
			    this.ladders.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 25, 'ladders', 0, true, false, this.ladders);

			    this.spikes = Game.add.group();
			    this.spikes.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 26, 'spikes', 0, true, false, this.spikes);

			    this.martha = Game.add.sprite(Game.world.width - 32, 64, "martha");
				this.martha.name = "martha";
			  	this.martha.anchor.setTo(.5,.5);
				this.martha.scale.x = -1; 

			  	// Player = Game.add.sprite(128, 0, "willy");
			    Player = Game.add.sprite(0, Game.world.height - 96, "willy");
			    Player.name = "willy";
			    Player.anchor.setTo(.5,.5);

				this.explosion = Game.add.sprite(0, Game.world.height - 96, "explosion");
				this.explosion.name = "explosion";

			    Game.physics.arcade.enable(this.martha);
			    Game.physics.arcade.enable(Player);
				
			    this.martha.body.immovable = true;
			    this.martha.animations.add('splash', [1,2,3,4], 5, true);

				Player.body.checkCollision.up = false;
				Player.inputEnabled = true;
			    Player.events.onInputDown.add(Setup.spriteTest, this);
			    Player.body.setSize(32, 64, 0, 0);
			    Player.body.gravity.y = 1000;
			    Player.body.collideWorldBounds = true;

			    Player.animations.add('walk', [2,3,2,4], 8, true);
		    	Player.animations.add('dance', [0,0,1,1], 8, true);
		    	Player.animations.add('climb', [5,5,6,6], 8, true);

		    	this.explosion.animations.add('explode', [0,1,2,3,4,5], 6, true);

			    this.emitter = Game.add.emitter(0, 0, 500);

			    this.emitter.makeParticles('blood');
			    this.emitter.gravity = 200;

			    Game.camera.follow(Player);

	 		},
	 		update: function(){


	 			if(Setup.wait < 1){

	 				Player.scale.x = 1; 
	 				this.explosion.animations.play('explode', 10, false);
	 				Game.sound.play("explosion");
	 				setTimeout(function(){
						Setup.velocityX = 100;
	 				}, 200);
	 			
	 			}

	 			Setup.wait++;

	 			Game.physics.arcade.collide(Player, this.martha, touchedMartha, null, this);
				Game.physics.arcade.collide(Player, this.layer);
	 			Game.physics.arcade.overlap(Player, this.ladders, Setup.climbLadder, null, this);
	 			Game.physics.arcade.overlap(Player, this.spikes, Setup.death, null, this);

				Setup.controls();

				Player.body.velocity.x = Setup.velocityX;

				if(Setup.walking){
					Player.animations.play('walk');
				}
				
				if(Player.body.blocked.left){
					Setup.velocityX = 100;
				} else if(Player.body.blocked.right){
					Setup.velocityX = -100;
				}

				if(Setup.velocityX === -100){
					Player.scale.x = -1; 
				} else if (Setup.velocityX === 100){
					Player.scale.x = 1; 
				}

				if(Game.physics.arcade.overlap(Player, this.ladders)){
					Setup.isClimbing = true;
				} else {
					Setup.isClimbing = false;
				}

				if(!Setup.isClimbing){
					Setup.climbingFinish();
				}

				function touchedMartha(){
					Setup.didWin = true;
					Setup.walking = false;

				}

				if(Setup.didWin){

					Setup.endScreen();

				}

				if(!Player.alive){
					Player.animations.stop();		
					Player.frame = 7;
					Setup.velocityX = 0;
					Player.body.velocity.y = 100;
				}

	 		}

	 	},
	 	6: {
	 		map: null,
	 		cursors: {},
	 		replacements: {
	 			1: 3
	 		},
	 		preload: function(){

	 			Setup.currentLevel = [0,6];

	 			Game.load.tilemap('map', '/games/noeyeswilly/assets/tilemaps/level0_6.json', null, Phaser.Tilemap.TILED_JSON);

	 			Levels.preloadDetails();

	 		},
	 		create: function(){

	 			this.map = Game.add.tilemap('map');
			    this.map.addTilesetImage("tiles", 'tiles');
			   	this.map.setCollisionBetween(1,18);
			   	this.map.setCollision(20);

			    this.layer = this.map.createLayer('Tile Layer 1');
			    this.layer.resizeWorld();

	    		Game.physics.startSystem(Phaser.Physics.ARCADE);

			    this.ladders = Game.add.group();
			    this.ladders.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 25, 'ladders', 0, true, false, this.ladders);

			    this.spikes = Game.add.group();
			    this.spikes.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 26, 'spikes', 0, true, false, this.spikes);

			    this.martha = Game.add.sprite(Game.world.width - 96, 64, "martha");
				this.martha.name = "martha";
			  	this.martha.anchor.setTo(.5,.5);
				this.martha.scale.x = 1; 

			  	// Player = Game.add.sprite(128, 0, "willy");
			    Player = Game.add.sprite(Game.world.width - 192, 64, "willy");
			    Player.name = "willy";
			    Player.anchor.setTo(.5,.5);

				this.explosion = Game.add.sprite(Game.world.width - 224, 32, "explosion");
				this.explosion.name = "explosion";

			    Game.physics.arcade.enable(this.martha);
			    Game.physics.arcade.enable(Player);
				
			    this.martha.body.immovable = true;
			    this.martha.animations.add('splash', [1,2,3,4], 5, true);

				Player.body.checkCollision.up = false;
				Player.inputEnabled = true;
			    Player.events.onInputDown.add(Setup.spriteTest, this);
			    Player.body.setSize(32, 64, 0, 0);
			    Player.body.gravity.y = 1000;
			    Player.body.collideWorldBounds = true;

			    Player.animations.add('walk', [2,3,2,4], 8, true);
		    	Player.animations.add('dance', [0,0,1,1], 8, true);
		    	Player.animations.add('climb', [5,5,6,6], 8, true);

		    	this.explosion.animations.add('explode', [0,1,2,3,4,5], 6, true);

			    this.emitter = Game.add.emitter(0, 0, 500);

			    this.emitter.makeParticles('blood');
			    this.emitter.gravity = 200;

			    Game.camera.follow(Player);

	 		},
	 		update: function(){

	 			if(Setup.wait < 1){

	 				Player.scale.x = -1; 
	 				this.explosion.animations.play('explode', 10, false);
	 				Game.sound.play("explosion");
	 				setTimeout(function(){
						Setup.velocityX = -100;
	 				}, 200);
	 			
	 			}

	 			Setup.wait++;

	 			Game.physics.arcade.collide(Player, this.martha, touchedMartha, null, this);
				Game.physics.arcade.collide(Player, this.layer);
	 			Game.physics.arcade.overlap(Player, this.ladders, Setup.climbLadder, null, this);
	 			Game.physics.arcade.overlap(Player, this.spikes, Setup.death, null, this);

				Setup.controls();

				Player.body.velocity.x = Setup.velocityX;

				if(Setup.walking){
					Player.animations.play('walk');
				}
				
				if(Player.body.blocked.left){
					Setup.velocityX = 100;
				} else if(Player.body.blocked.right){
					Setup.velocityX = -100;
				}

				if(Setup.velocityX === -100){
					Player.scale.x = -1; 
				} else if (Setup.velocityX === 100){
					Player.scale.x = 1; 
				}

				if(Game.physics.arcade.overlap(Player, this.ladders)){
					Setup.isClimbing = true;
				} else {
					Setup.isClimbing = false;
				}

				if(!Setup.isClimbing){
					Setup.climbingFinish();
				}

				function touchedMartha(){
					Setup.didWin = true;
					Setup.walking = false;

				}

				if(Setup.didWin){

					Setup.endScreen();

				}

				if(!Player.alive){
					Player.animations.stop();		
					Player.frame = 7;
					Setup.velocityX = 0;
					Player.body.velocity.y = 100;
				}

	 		}

	 	},
	 	7: {
	 		map: null,
	 		cursors: {},
	 		replacements: {
	 			1: 3
	 		},
	 		preload: function(){

	 			Setup.currentLevel = [0,7];

	 			Game.load.tilemap('map', '/games/noeyeswilly/assets/tilemaps/level0_7.json', null, Phaser.Tilemap.TILED_JSON);

	 			Levels.preloadDetails();

	 		},
	 		create: function(){

	 			this.map = Game.add.tilemap('map');
			    this.map.addTilesetImage("tiles", 'tiles');
			   	this.map.setCollisionBetween(1,18);
			   	this.map.setCollision(20);

			    this.layer = this.map.createLayer('Tile Layer 1');
			    this.layer.resizeWorld();

	    		Game.physics.startSystem(Phaser.Physics.ARCADE);

			    this.ladders = Game.add.group();
			    this.ladders.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 25, 'ladders', 0, true, false, this.ladders);

			    this.spikes = Game.add.group();
			    this.spikes.enableBody = true;

			    this.map.createFromObjects('Object Layer 1', 26, 'spikes', 0, true, false, this.spikes);

			    this.martha = Game.add.sprite(Game.world.width - 192, 32, "martha");
				this.martha.name = "martha";
			  	this.martha.anchor.setTo(.5,.5);
				this.martha.scale.x = 1; 

			  	// Player = Game.add.sprite(128, 0, "willy");
			    Player = Game.add.sprite(Game.world.width - 32, Game.world.height - 96, "willy");
			    Player.name = "willy";
			    Player.anchor.setTo(.5,.5);

				this.explosion = Game.add.sprite(Game.world.width - 64, Game.world.height - 128, "explosion");
				this.explosion.name = "explosion";

			    Game.physics.arcade.enable(this.martha);
			    Game.physics.arcade.enable(Player);
				
			    this.martha.body.immovable = true;
			    this.martha.animations.add('splash', [1,2,3,4], 5, true);

				Player.body.checkCollision.up = false;
				Player.inputEnabled = true;
			    Player.events.onInputDown.add(Setup.spriteTest, this);
			    Player.body.setSize(32, 64, 0, 0);
			    Player.body.gravity.y = 1000;
			    Player.body.collideWorldBounds = true;

			    Player.animations.add('walk', [2,3,2,4], 8, true);
		    	Player.animations.add('dance', [0,0,1,1], 8, true);
		    	Player.animations.add('climb', [5,5,6,6], 8, true);

		    	this.explosion.animations.add('explode', [0,1,2,3,4,5], 6, true);

			    this.emitter = Game.add.emitter(0, 0, 500);

			    this.emitter.makeParticles('blood');
			    this.emitter.gravity = 200;

			    Game.camera.follow(Player);

	 		},
	 		update: function(){

	 			if(Setup.wait < 1){

	 				Player.scale.x = -1; 
	 				this.explosion.animations.play('explode', 10, false);
	 				Game.sound.play("explosion");
	 				setTimeout(function(){
						Setup.velocityX = -100;
	 				}, 200);
	 			
	 			}

	 			Setup.wait++;

	 			Game.physics.arcade.collide(Player, this.martha, touchedMartha, null, this);
				Game.physics.arcade.collide(Player, this.layer);
	 			Game.physics.arcade.overlap(Player, this.ladders, Setup.climbLadder, null, this);
	 			Game.physics.arcade.overlap(Player, this.spikes, Setup.death, null, this);

				Setup.controls();

				Player.body.velocity.x = Setup.velocityX;

				if(Setup.walking){
					Player.animations.play('walk');
				}
				
				if(Player.body.blocked.left){
					Setup.velocityX = 100;
				} else if(Player.body.blocked.right){
					Setup.velocityX = -100;
				}

				if(Setup.velocityX === -100){
					Player.scale.x = -1; 
				} else if (Setup.velocityX === 100){
					Player.scale.x = 1; 
				}

				if(Game.physics.arcade.overlap(Player, this.ladders)){
					Setup.isClimbing = true;
				} else {
					Setup.isClimbing = false;
				}

				if(!Setup.isClimbing){
					Setup.climbingFinish();
				}

				function touchedMartha(){
					Setup.didWin = true;
					Setup.walking = false;

				}

				if(Setup.didWin){

					Setup.endScreen();

				}

				if(!Player.alive){
					Player.animations.stop();		
					Player.frame = 7;
					Setup.velocityX = 0;
					Player.body.velocity.y = 100;
				}

	 		}

	 	}

	}

};