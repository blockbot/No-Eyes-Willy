var Boot = {
	preload: function(){

		Game.stage.backgroundColor = "#c0dbe2";

		Game.load.image('tiles', '/games/noeyeswilly/assets/tiles/tiles.png');
		Game.load.image('ladders', '/games/noeyeswilly/assets/tiles/ladders.png');
		Game.load.image('spikes', '/games/noeyeswilly/assets/tiles/spikes.png');
		Game.load.image('blood', '/games/noeyeswilly/assets/sprites/blood.png');
		Game.load.image('skull', '/games/noeyeswilly/assets/sprites/skull.png');

		Game.load.spritesheet('martha', '/games/noeyeswilly/assets/sprites/martha.png', 64, 64, 5);
		Game.load.spritesheet('explosion', '/games/noeyeswilly/assets/sprites/explosion.png', 64, 64, 6);
		Game.load.spritesheet('willy', '/games/noeyeswilly/assets/sprites/willy.png', 64, 64, 8);
		Game.load.spritesheet('clean', '/games/noeyeswilly/assets/sprites/clean.png', 128, 192, 2);

		Game.load.bitmapFont('04b', '/games/noeyeswilly/assets/fonts/zerofourbee/font.png', '/games/noeyeswilly/assets/fonts/zerofourbee/font.fnt');

		Game.load.spritesheet('btnRetry', '/games/noeyeswilly/assets/sprites/btn-retry.png', 128, 64);
		Game.load.spritesheet('btnNext', '/games/noeyeswilly/assets/sprites/btn-next.png', 128, 64);
		Game.load.spritesheet('btnRestart', '/games/noeyeswilly/assets/sprites/btn-restart.png', 128, 128);

		Game.load.audio('death', '/games/noeyeswilly/assets/sounds/death.wav');
		Game.load.audio('explosion', '/games/noeyeswilly/assets/sounds/explosion.wav');
		Game.load.audio('powerup', '/games/noeyeswilly/assets/sounds/powerup.wav');
		Game.load.audio('select', '/games/noeyeswilly/assets/sounds/select.wav');
		Game.load.audio('splash', '/games/noeyeswilly/assets/sounds/splash.wav');

	},
	create: function(){

	}, 
	update: function(){

	}
	
}