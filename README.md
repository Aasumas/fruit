# 🍎 Fruit Merge Game 🍊

A fun and addictive physics-based puzzle game where you drop and merge fruits to create bigger ones! Built with vanilla JavaScript and HTML5 Canvas.

![Game Preview](https://img.shields.io/badge/Game-Playable-brightgreen) ![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Android-blue) ![License](https://img.shields.io/badge/License-CC--BY--NC--SA-yellow)

## 📸 Game Screenshot

![Fruit Merge Game Screenshot](Screenshot.png)

*Experience the addictive fruit-merging gameplay with realistic-ish physics and beautiful visual effects!*

## 🎮 How to Play

1. **Drop Fruits**: Click anywhere on the game area or use the "Drop Fruit" button to release fruits
2. **Merge Strategy**: When two identical fruits touch, they merge into the next fruit in the evolution chain
3. **Stack Carefully**: Fruits stack with realistic physics - plan your drops to create efficient merges
4. **Avoid Game Over**: Don't let fruits pile up above the danger line for too long
5. **Score Points**: Earn points for each successful merge - bigger fruits = more points!

## 🍇 Fruit Evolution Chain

```
🍒 → 🍓 → 🫐 → 🍇 → 🥝 → 🍋 → 🍊 → 🍎 → 🍑 → 🥭 → 🍍 → 🥥
```

Start with cherries and work your way up to the ultimate coconut!

## ✨ Features

### 🎯 Core Gameplay
- **Physics-Based Movement**: Realistic fruit dropping and collision detection
- **Merge Mechanics**: Identical fruits combine into evolved forms
- **Score System**: Points awarded based on fruit size and merge complexity
- **Next Fruit Preview**: See your next 3 fruits to plan ahead

### 🔧 Technical Features
- **Anti-Compression System**: Prevents fruits from overlapping unrealistically
- **Boundary Collision**: Fruits bounce off walls and stack naturally
- **Danger Mode**: Visual warning when fruits get too high
- **Responsive Design**: Works on desktop and mobile browsers
- **Smooth Animations**: 60 FPS canvas rendering for fluid gameplay

### 🎨 Visual Polish
- **Clean UI**: Modern, intuitive interface
- **Fruit Guide**: Visual evolution chain reference
- **Game Over Screen**: Clear feedback with final score
- **Restart Functionality**: Quick game reset with clean state

## 🚀 Quick Start

### Web Version (Instant Play)
1. Clone this repository:
   ```bash
   git clone https://github.com/aasumas/fruit-merge-game.git
   cd fruit-merge-game
   ```

2. Start a local server:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. Open your browser and navigate to `http://localhost:8000`

### Android Version
1. Download the `FruitGame.apk` file from the releases
2. Enable "Install from Unknown Sources" in your Android settings
3. Install the APK and enjoy mobile gaming!

## 📱 Mobile Support

The game includes a native Android APK built with Apache Cordova:
- **Offline Play**: No internet connection required
- **Touch Controls**: Optimized for mobile interaction
- **Native Performance**: Smooth gameplay on Android devices
- **Full Feature Parity**: All web features available on mobile

## 🛠️ Development

### Project Structure
```
fruit-merge-game/
├── index.html          # Main game page
├── script.js           # Game logic and physics
├── style.css           # Styling and layout
├── FruitGame.apk       # Android APK build
├── FruitGameAndroid/   # Cordova project files
└── README.md           # This file
```

### Key Technologies
- **HTML5 Canvas**: For game rendering and animations
- **Vanilla JavaScript**: Core game logic and physics engine
- **CSS3**: Modern styling and responsive design
- **Apache Cordova**: Mobile app packaging

### Game Physics
The game implements a custom physics engine featuring:
- **Collision Detection**: Circle-based collision with optimized algorithms
- **Velocity Calculations**: Realistic momentum and bounce effects
- **Separation Logic**: Anti-compression system prevents unrealistic stacking
- **Boundary Handling**: Proper wall and floor collision responses

## 🎯 Game Mechanics Deep Dive

### Collision System
- **Detection**: Efficient distance-based collision detection
- **Resolution**: Physics-based separation with velocity dampening
- **Merging**: Automatic fruit evolution when identical fruits collide
- **Boundaries**: Proper handling of wall and floor interactions

### Scoring Algorithm
- **Base Points**: Each fruit type has a base point value
- **Merge Bonus**: Additional points for successful combinations
- **Chain Reactions**: Bonus multipliers for consecutive merges
- **Size Scaling**: Larger fruits provide exponentially more points

### Difficulty Progression
- **Fruit Variety**: Random selection from available fruit types
- **Preview System**: Strategic planning with next fruit visibility
- **Danger Zone**: Escalating tension as fruits approach the limit
- **Game Over**: Clear failure conditions with recovery options

## 🔧 Building from Source

### Web Version
No build process required - just serve the files statically.

### Android APK
1. Install dependencies:
   ```bash
   npm install -g cordova
   brew install --cask temurin@17
   brew install android-commandlinetools gradle
   ```

2. Set up environment:
   ```bash
   export ANDROID_HOME=/usr/local/share/android-commandlinetools
   export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
   ```

3. Build APK:
   ```bash
   cd FruitGameAndroid
   cordova build android
   ```

## 🤝 Contributing

Contributions are welcome! Here are some ways you can help:

- 🐛 **Bug Reports**: Found an issue? Open a GitHub issue
- 💡 **Feature Ideas**: Suggest new gameplay mechanics or improvements
- 🎨 **Visual Enhancements**: Improve graphics, animations, or UI
- 📱 **Platform Support**: Help expand to iOS or other platforms
- 🧪 **Testing**: Test on different devices and browsers

### Development Guidelines
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0). 

**You are free to:**
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

**Under the following terms:**
- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- **NonCommercial** — You may not use the material for commercial purposes
- **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original

See the full license at: https://creativecommons.org/licenses/by-nc-sa/4.0/

## 🙏 Acknowledgments

- Inspired by the popular Suika Game (Watermelon Game)
- Physics concepts adapted from various game development resources
- Emoji fruits for visual appeal and universal recognition
- Community feedback for gameplay improvements

## 📊 Stats

- **Lines of Code**: ~500 JavaScript, ~200 CSS, ~50 HTML
- **File Size**: ~3.4MB APK, <100KB web version
- **Performance**: 60 FPS on modern devices
- **Compatibility**: Chrome 60+, Firefox 55+, Safari 12+, Android 7+

---

**Ready to play?** [🎮 Start Game](https://aasumas.github.io/fruit/) | [📱 Download APK](FruitGame.apk)

Made with ❤️ and lots of fruit emojis!