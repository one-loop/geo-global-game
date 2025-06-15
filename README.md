# Geo Globe Game

A Wordle-like geography game where players guess the country of the day using an interactive 3D globe. Each guess provides feedback through color-coding based on the distance from the target country.

## Features

- Interactive 3D globe visualization
- Daily country challenge
- 10 guesses per day
- Color-coded feedback system:
  - Green: Correct country
  - Dark Red: Very close (< 1000km)
  - Red: Close (< 2500km)
  - Orange: Far (< 5000km)
  - Yellow: Very far (> 5000km)

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Play

1. Each day, a new country is randomly selected
2. You have 10 attempts to guess the correct country
3. Type a country name and press Enter or click the "Guess" button
4. The guessed country will be highlighted on the globe
5. The color indicates how close you are to the target country
6. Try to guess the country within 10 attempts!

## Technologies Used

- React
- Three.js
- React Globe.GL
- Chakra UI
- date-fns

## License

MIT
