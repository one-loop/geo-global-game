import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Globe from 'react-globe.gl';
import { format } from 'date-fns';
import countriesGeoJson from '../data/countries-50m.json';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { cn } from '../lib/utils';

const MAX_GUESSES = 10;
const EARTH_RADIUS_KM = 6371;
const GAME_STATE_KEY = 'geoGlobeGameState';
const STATS_KEY = 'geoGlobeStats';

// Process the GeoJSON data to create our country list
const countryData = countriesGeoJson.features.map(feature => ({
  name: feature.properties.NAME || feature.properties.ADMIN,
  latitude: feature.properties.LATITUDE || feature.properties.LAT || 0,
  longitude: feature.properties.LONGITUDE || feature.properties.LONG || 0,
  geometry: feature.geometry,
  id: feature.properties.ISO_A3 || feature.properties.ADM0_A3
}));

const GeoGlobeGame = () => {
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [targetCountry, setTargetCountry] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showDistanceGuide, setShowDistanceGuide] = useState(true);
  const [showPreviousGuesses, setShowPreviousGuesses] = useState(true);
  const [globeStyle, setGlobeStyle] = useState('default'); // 'default', 'satellite', 'dark'
  const [selectedRegion, setSelectedRegion] = useState('all'); // 'all', 'europe', 'asia', etc.
  const [distanceUnit, setDistanceUnit] = useState('km'); // 'km' or 'mi'
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    guessDistribution: {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 
      6: 0, 7: 0, 8: 0, 9: 0, 10: 0
    }
  });
  
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  const statsModalRef = useRef(null);
  const statsButtonRef = useRef(null);
  const infoModalRef = useRef(null);
  const infoButtonRef = useRef(null);
  const settingsModalRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const addToast = useCallback((toast) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 3000);
  }, []);

  // Load saved game state
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const savedState = localStorage.getItem(GAME_STATE_KEY);
    
    if (savedState) {
      const { date, guesses: savedGuesses, gameOver: savedGameOver, won: savedWon } = JSON.parse(savedState);
      
      if (date === today) {
        setGuesses(savedGuesses);
        setGameOver(savedGameOver);
        setWon(savedWon);
      } else {
        localStorage.removeItem(GAME_STATE_KEY);
      }
    }
  }, []);

  // Get daily country based on the date
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    // Create a more unique seed using date components
    const dateParts = today.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    
    // Combine date components with prime numbers for better distribution
    const seed = (year * 373) + (month * 37) + (day * 7);
    const countryIndex = seed % countryData.length;
    setTargetCountry(countryData[countryIndex]);
    setIsLoading(false);
  }, []);

  // Save game state
  useEffect(() => {
    if (!isLoading) {
      const today = format(new Date(), 'yyyy-MM-dd');
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
        date: today,
        guesses,
        gameOver,
        won
      }));
    }
  }, [guesses, gameOver, won, isLoading]);

  // Load stats from localStorage
  useEffect(() => {
    const savedStats = localStorage.getItem(STATS_KEY);
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    }
  }, []);

  // Update stats when game is won
  const updateStats = useCallback((won, numGuesses) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    setStats(prevStats => {
      // If the user has already played today, don't update stats
      if (prevStats.lastPlayedDate === today) {
        return prevStats;
      }

      const newStats = { ...prevStats };
      
      // Update games played and won
      newStats.gamesPlayed++;
      if (won) {
        newStats.gamesWon++;
        newStats.guessDistribution[numGuesses]++;
      }
      
      // Update streak
      if (won) {
        if (prevStats.lastPlayedDate === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')) {
          newStats.currentStreak++;
        } else {
          newStats.currentStreak = 1;
        }
        newStats.maxStreak = Math.max(newStats.currentStreak, prevStats.maxStreak);
      } else {
        newStats.currentStreak = 0;
      }
      
      newStats.lastPlayedDate = today;
      
      // Save to localStorage
      localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
      return newStats;
    });
  }, []);

  // Calculate the centroid of a polygon
  const calculateCentroid = useCallback((coordinates) => {
    if (!coordinates || coordinates.length === 0) return [0, 0];
    
    try {
      // Handle MultiPolygon
      if (coordinates[0][0][0] && typeof coordinates[0][0][0] === 'number') {
        // Single polygon
        const points = coordinates[0];
        const sumLat = points.reduce((sum, point) => sum + point[1], 0);
        const sumLng = points.reduce((sum, point) => sum + point[0], 0);
        return [sumLng / points.length, sumLat / points.length];
      } else {
        // MultiPolygon - use the largest polygon
        const polygons = coordinates.map(poly => poly[0]);
        const largestPolygon = polygons.reduce((largest, current) => 
          current.length > largest.length ? current : largest
        , polygons[0]);
        
        const sumLat = largestPolygon.reduce((sum, point) => sum + point[1], 0);
        const sumLng = largestPolygon.reduce((sum, point) => sum + point[0], 0);
        return [sumLng / largestPolygon.length, sumLat / largestPolygon.length];
      }
    } catch (error) {
      console.error('Error calculating centroid:', error);
      return [0, 0];
    }
  }, []);

  // Calculate distance between two points on Earth
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    try {
      const toRad = (deg) => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return EARTH_RADIUS_KM * c;
    } catch (error) {
      console.error('Error calculating distance:', error);
      return Infinity;
    }
  }, []);

  // Get color based on distance
  const getColorByDistance = useCallback((distance) => {
    if (distance === 0) return 'rgba(52, 211, 153, 0.8)';     // Keep the emerald green for correct
    if (distance < 1000) return 'rgba(74, 98, 138, 0.8)';     // Dark blue for very close
    if (distance < 2500) return 'rgba(122, 178, 211, 0.8)';   // Medium blue for close
    if (distance < 5000) return 'rgba(185, 229, 232, 0.8)';   // Light blue for far
    return 'rgba(223, 242, 235, 0.8)';                        // Mint for very far
  }, []);

  // Get random country for practice mode
  const getRandomCountry = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * countryData.length);
    return countryData[randomIndex];
  }, []);

  // Reset game state for practice mode
  const resetPracticeGame = useCallback(() => {
    setGuesses([]);
    setGameOver(false);
    setWon(false);
    setCurrentGuess('');
    setTargetCountry(getRandomCountry());
  }, [getRandomCountry]);

  // Modified handleGuess to hide suggestions
  const handleGuess = useCallback(() => {
    // Hide suggestions when making a guess
    setShowSuggestions(false);
    
    if (isLoading || !targetCountry) {
      addToast({
        title: 'Game not ready',
        description: 'Please wait a moment and try again',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    if (!currentGuess.trim()) {
      addToast({
        title: 'Empty guess',
        description: 'Please enter a country name',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    const guessedCountry = countryData.find(
      (country) => country.name.toLowerCase().trim() === currentGuess.toLowerCase().trim()
    );

    if (!guessedCountry) {
      addToast({
        title: 'Invalid country',
        description: 'Please enter a valid country name',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Check if country has already been guessed
    const alreadyGuessed = guesses.some(
      guess => guess.properties.name.toLowerCase().trim() === guessedCountry.name.toLowerCase().trim()
    );

    if (alreadyGuessed) {
      addToast({
        title: 'Already Guessed',
        description: `You've already guessed ${guessedCountry.name}. Try a different country!`,
        status: 'warning',
        duration: 3000,
      });
      setCurrentGuess('');
      return;
    }

    try {
      // Calculate centroid for distance calculation
      const [guessedLon, guessedLat] = calculateCentroid(guessedCountry.geometry.coordinates);
      const [targetLon, targetLat] = calculateCentroid(targetCountry.geometry.coordinates);

      const distance = calculateDistance(
        guessedLat,
        guessedLon,
        targetLat,
        targetLon
      );

      const newGuess = {
        type: 'Feature',
        properties: {
          name: guessedCountry.name,
          distance: distance
        },
        geometry: guessedCountry.geometry,
        color: getColorByDistance(distance)
      };

      setGuesses((prev) => [...prev, newGuess]);
      setCurrentGuess('');

      if (distance === 0) {
        setWon(true);
        setGameOver(true);
        if (!isPracticeMode) {
          updateStats(true, guesses.length + 1);
          setShowStats(true);
        } else {
          addToast({
            title: '🎉 Congratulations!',
            description: `You found ${targetCountry.name}! Click "Play Again" to try another country.`,
            status: 'success',
            duration: 5000,
          });
        }
      } else if (!isPracticeMode && guesses.length + 1 >= MAX_GUESSES) {
        setGameOver(true);
        updateStats(false, MAX_GUESSES);
        addToast({
          title: 'Game Over',
          description: `The country was ${targetCountry.name}`,
          status: 'error',
          duration: 10000,
        });
      }
    } catch (error) {
      console.error('Error processing guess:', error);
      addToast({
        title: 'Error',
        description: 'An error occurred while processing your guess. Please try again.',
        status: 'error',
        duration: 3000,
      });
    }
  }, [currentGuess, targetCountry, guesses.length, addToast, isLoading, calculateCentroid, calculateDistance, getColorByDistance, updateStats, isPracticeMode]);

  // Create a list of country suggestions for the input
  const countryNames = useMemo(() => countryData.map(country => country.name), []);

  // Add click outside handler for modals
  useEffect(() => {
    function handleClickOutside(event) {
      // Handle suggestions dropdown
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      
      // Handle stats modal - ignore clicks on the stats button
      if (statsModalRef.current && 
          !statsModalRef.current.contains(event.target) &&
          !statsButtonRef.current?.contains(event.target)) {
        setShowStats(false);
      }

      // Handle info modal - ignore clicks on the info button
      if (infoModalRef.current && 
          !infoModalRef.current.contains(event.target) &&
          !infoButtonRef.current?.contains(event.target)) {
        setShowInfo(false);
      }

      // Handle settings modal - ignore clicks on the settings button
      if (settingsModalRef.current && 
          !settingsModalRef.current.contains(event.target) &&
          !settingsButtonRef.current?.contains(event.target)) {
        setShowSettings(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter countries based on input
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setCurrentGuess(value);
    setSelectedIndex(-1); // Reset selection when input changes
    
    if (value.length > 0) {
      const filtered = countryNames
        .filter(name => name.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5); // Limit to 5 suggestions
      setFilteredCountries(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredCountries([]);
      setShowSuggestions(false);
    }
  }, [countryNames]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') {
        handleGuess();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCountries.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCountries.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionClick(filteredCountries[selectedIndex]);
        } else {
          setShowSuggestions(false);
          handleGuess();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion) => {
    setCurrentGuess(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Helper function to convert distance based on selected unit
  const formatDistance = (distanceKm) => {
    if (distanceUnit === 'mi') {
      return `${Math.round(distanceKm * 0.621371)} mi`;
    }
    return `${Math.round(distanceKm)} km`;
  };

  // Region definitions
  const regions = {
    all: { name: 'All Countries', description: 'Countries from all continents' },
    europe: { name: 'Europe', description: 'European countries only' },
    asia: { name: 'Asia', description: 'Asian countries only' },
    americas: { name: 'Americas', description: 'North and South American countries' },
    africa: { name: 'Africa', description: 'African countries only' },
    oceania: { name: 'Oceania', description: 'Oceanian countries only' }
  };

  // Filter countries based on selected region
  const getFilteredCountries = () => {
    if (selectedRegion === 'all') return countryData;
    return countryData.filter(country => country.region === selectedRegion);
  };

  const StatsModal = () => {
    const maxGuesses = Math.max(...Object.values(stats.guessDistribution));
    const winPercentage = stats.gamesPlayed > 0 
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) 
      : 0;

    return (
      <div ref={statsModalRef} className="bg-[#1a1a1a] p-8 rounded-xl w-[90%] max-w-md border border-[#232323]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-['EB Garamond'] text-white">Statistics</h2>
          <button 
            onClick={() => setShowStats(false)}
            className="text-white/60 hover:text-white/80 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">{stats.gamesPlayed}</div>
            <div className="text-xs text-white/60">Played</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">{winPercentage}</div>
            <div className="text-xs text-white/60">Win %</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">{stats.currentStreak}</div>
            <div className="text-xs text-white/60">Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">{stats.maxStreak}</div>
            <div className="text-xs text-white/60">Max Streak</div>
          </div>
        </div>

        <h3 className="text-lg font-['EB Garamond'] text-white mb-4">Guess Distribution</h3>
        <div className="space-y-2">
          {Object.entries(stats.guessDistribution).map(([guesses, count]) => (
            <div key={guesses} className="flex items-center gap-2">
              <div className="text-white/80 w-4">{guesses}</div>
              <div className="flex-1 h-5 relative">
                <div 
                  className="absolute inset-0 bg-[#4A628A]/20 rounded"
                  style={{
                    width: count > 0 ? `${(count / maxGuesses) * 100}%` : '8px',
                  }}
                >
                  <div className="absolute inset-0 flex items-center px-2 text-xs text-white/80">
                    {count}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const InfoModal = () => {
    return (
      <div ref={infoModalRef} className="bg-[#1a1a1a] p-8 rounded-xl w-[90%] max-w-3xl border border-[#232323]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-['EB Garamond'] text-white">How to Play</h2>
          <button 
            onClick={() => setShowInfo(false)}
            className="text-white/60 hover:text-white/80 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 text-white/80">
          <p>Welcome to Globle! Try to guess the mystery country in 6 tries or less.</p>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-white font-semibold">How it works:</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Type a country name and press enter to make a guess</li>
                  <li>The globe will highlight your guess and show how close you are</li>
                  <li>Use the colors below to gauge your distance from the target</li>
                </ul>
              </div>

              <div>
                <p className="mb-2">The globe is interactive! You can:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Drag to rotate the view</li>
                  <li>Scroll to zoom in/out</li>
                  <li>Click and hold to tilt the perspective</li>
                </ul>
              </div>

              <p className="text-white/60 text-sm">A new country is selected each day. Come back daily to test your geography knowledge!</p>
            </div>

            <div className="bg-[#232323] p-6 rounded-lg space-y-3">
              <h3 className="text-white font-semibold mb-4">Distance Indicators:</h3>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span>Correct - You found it!</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-[#7AB2D3]"></div>
                <span>Less than 1000km away</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-[#4A628A]"></div>
                <span>Less than 2500km away</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-purple-900"></div>
                <span>Less than 5000km away</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-[#DFF2EB]"></div>
                <span>More than 5000km away</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Settings Modal Component
  const SettingsModal = () => {
    return (
      <div ref={settingsModalRef} className="bg-[#1a1a1a] rounded-xl w-[90%] max-w-md border border-[#232323] flex flex-col max-h-[85vh]">
        {/* Fixed Header */}
        <div className="p-8 pb-4 border-b border-[#232323]">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-['EB Garamond'] text-white">Settings</h2>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-white/60 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6 custom-scrollbar">
          {/* Game Modes */}
          <div className="space-y-4">
            <h3 className="text-white/90 text-lg font-semibold">Game Modes</h3>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-semibold">Practice Mode</h4>
                <p className="text-white/60 text-sm mt-1">Play unlimited games with random countries</p>
              </div>
              <Switch
                checked={isPracticeMode}
                onCheckedChange={(checked) => {
                  setIsPracticeMode(checked);
                  if (checked) {
                    resetPracticeGame();
                  } else {
                    window.location.reload();
                  }
                }}
                className="ml-4"
              />
            </div>

            {isPracticeMode && (
              <div className="space-y-2 mt-4">
                <h4 className="text-white font-semibold">Region Selection</h4>
                <p className="text-white/60 text-sm mb-3">Choose which region to practice</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(regions).map(([key, { name }]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedRegion(key)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        selectedRegion === key
                          ? "bg-[#4A628A] text-white"
                          : "bg-white/10 text-white/60 hover:bg-white/20"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Globe Settings */}
          <div className="space-y-4">
            <h3 className="text-white/90 text-lg font-semibold">Globe Settings</h3>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-semibold">Auto-Rotate</h4>
                <p className="text-white/60 text-sm mt-1">Globe automatically rotates when idle</p>
              </div>
              <Switch
                checked={autoRotate}
                onCheckedChange={setAutoRotate}
                className="ml-4"
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-white font-semibold">Globe Style</h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setGlobeStyle('default')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    globeStyle === 'default' 
                      ? "bg-[#4A628A] text-white" 
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  )}
                >
                  Default
                </button>
                <button
                  onClick={() => setGlobeStyle('satellite')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    globeStyle === 'satellite' 
                      ? "bg-[#4A628A] text-white" 
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  )}
                >
                  Satellite
                </button>
                <button
                  onClick={() => setGlobeStyle('dark')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    globeStyle === 'dark' 
                      ? "bg-[#4A628A] text-white" 
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  )}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>

          {/* Interface Settings */}
          <div className="space-y-4">
            <h3 className="text-white/90 text-lg font-semibold">Interface</h3>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-semibold">Distance Guide</h4>
                <p className="text-white/60 text-sm mt-1">Show color guide for distances</p>
              </div>
              <Switch
                checked={showDistanceGuide}
                onCheckedChange={setShowDistanceGuide}
                className="ml-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-semibold">Previous Guesses</h4>
                <p className="text-white/60 text-sm mt-1">Show list of previous guesses</p>
              </div>
              <Switch
                checked={showPreviousGuesses}
                onCheckedChange={setShowPreviousGuesses}
                className="ml-4"
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-white font-semibold">Distance Unit</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDistanceUnit('km')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    distanceUnit === 'km'
                      ? "bg-[#4A628A] text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  )}
                >
                  Kilometers
                </button>
                <button
                  onClick={() => setDistanceUnit('mi')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    distanceUnit === 'mi'
                      ? "bg-[#4A628A] text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  )}
                >
                  Miles
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="p-8 pt-4 border-t border-[#232323]">
          <p className="text-white/40 text-sm">Settings are automatically saved to your device</p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-background">
      {/* Globe */}
      <div className="absolute inset-0 z-10">
        <Globe
          globeImageUrl={
            globeStyle === 'satellite' 
              ? "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              : globeStyle === 'dark'
                ? "//unpkg.com/three-globe/example/img/earth-night.jpg"
                : "//unpkg.com/three-globe/example/img/earth-day.jpg"
          }
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          polygonsData={guesses}
          polygonAltitude={0.01}
          polygonCapColor={d => d.color}
          polygonSideColor={() => 'rgba(255, 255, 255, 0.05)'}
          polygonStrokeColor={() => 'rgba(255, 255, 255, 0.3)'}
          polygonStrokeWidth={0.5}
          polygonsTransitionDuration={200}
          atmosphereColor="#1b66ff"
          atmosphereAltitude={0.15}
          enablePointerInteraction={true}
          dragRotate={true}
          autoRotate={autoRotate}
          autoRotateSpeed={0.35}
          zoomOnScroll={true}
          minZoom={0.5}
          maxZoom={2.5}
          rotateSpeed={0.8}
          enableGlobeCover={true}
          globeCoverAltitude={0.015}
          globeCoverColor={globeStyle === 'dark' ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.6)"}
          polygonLabel={({ properties }) =>
            `<div class="bg-popover/95 text-popover-foreground p-3 rounded-lg shadow-lg">
              <div class="font-semibold mb-1">${properties.name}</div>
              <div class="text-muted-foreground">Distance: ${Math.round(properties.distance)} km</div>
            </div>`
          }
        />
      </div>

      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/90 via-[#0a1520]/60 to-transparent pb-20">
        <div className="container max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight text-white font-['EB Garamond']">
              Globle {isPracticeMode && <span className="text-[#4A628A] ml-2">(Practice)</span>}
            </h1>
            <div className="flex items-center gap-4">
              <button
                ref={statsButtonRef}
                onClick={() => setShowStats(!showStats)}
                className="bg-[#1a1a1a] hover:bg-[#232323] text-white border border-[#232323] h-10 px-4 rounded-lg"
              >
                📊 Stats
              </button>
              <button
                ref={infoButtonRef}
                onClick={() => setShowInfo(!showInfo)}
                className="bg-[#1a1a1a] hover:bg-[#232323] text-white border border-[#232323] h-10 px-4 rounded-lg"
              >
                ℹ️ How to Play
              </button>
              <button
                ref={settingsButtonRef}
                onClick={() => setShowSettings(!showSettings)}
                className="bg-[#1a1a1a] hover:bg-[#232323] text-white border border-[#232323] h-10 px-4 rounded-lg"
              >
                ⚙️ Settings
              </button>
              {!isPracticeMode && (
                <Badge variant="secondary" className="py-2 px-5 bg-white/10 text-white font-medium text-sm border border-white/10 shadow-lg">
                  {MAX_GUESSES - guesses.length} Guesses Left
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <StatsModal />
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <InfoModal />
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <SettingsModal />
        </div>
      )}

      {/* Game Over Message - Modified for practice mode */}
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-[#1a1a1a]/95 p-10 rounded-2xl border border-[#232323] shadow-2xl backdrop-blur-md max-w-md w-[90%] text-center">
          <h2 className={cn(
            "text-4xl mb-6",
            won ? "text-[#7AB2D3] font-['EB Garamond']" : "text-[#B9E5E8] font-['EB Garamond']"
          )}>
            {won ? '🎉 Congratulations!' : 'Game Over'}
          </h2>
          <p className="text-xl mb-4 text-white/90">
            {won 
              ? `You found ${targetCountry?.name} in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}!`
              : `The country was ${targetCountry?.name}`
            }
          </p>
          <a 
            href={`https://en.wikipedia.org/wiki/${targetCountry?.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 mb-6 text-[#7AB2D3] hover:text-[#7AB2D3]/80 transition-colors underline text-lg"
          >
            Learn more about {targetCountry?.name} on Wikipedia
          </a>
          {won && !isPracticeMode && (
            <p className="text-[#B9E5E8]/80 text-lg font-light">
              Come back tomorrow for a new challenge!
            </p>
          )}
          {isPracticeMode && (
            <button
              onClick={resetPracticeGame}
              className="mt-6 bg-[#4A628A] hover:bg-[#4A628A]/90 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Play Again
            </button>
          )}
        </div>
      )}

      {/* Bottom Section with Input and Guesses */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pt-20 pb-8 bg-gradient-to-t from-black/90 via-[#0a1520]/60 to-transparent">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="space-y-5">
            {/* Previous Guesses */}
            {showPreviousGuesses && guesses.length > 0 && (
              <div className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-white/5">
                <div className="flex gap-2.5 pb-1">
                  {guesses.map((guess, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg text-sm"
                    >
                      <span className="text-white/90">{guess.properties.name}</span>
                      <span className="text-white/60">
                        {formatDistance(guess.properties.distance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Section */}
            {!gameOver && (
              <div className="flex gap-3 relative">
                <div className="relative flex-1">
                  {showSuggestions && filteredCountries.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute bottom-full mb-2 w-full bg-[#1a1a1a] border border-[#232323] rounded-lg shadow-2xl backdrop-blur-sm overflow-hidden"
                    >
                      {filteredCountries.map((country, index) => (
                        <button
                          key={country}
                          className={cn(
                            "w-full px-4 py-3 text-left text-white transition-colors cursor-pointer",
                            selectedIndex === index ? "bg-white/10" : "hover:bg-white/5"
                          )}
                          onClick={() => handleSuggestionClick(country)}
                          onMouseEnter={() => setSelectedIndex(index)}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input
                    ref={inputRef}
                    placeholder="Enter country name..."
                    value={currentGuess}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="h-12 bg-[#1a1a1a] border-[#232323] rounded-[8px] text-white placeholder:text-[#696969] focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none text-lg"
                  />
                </div>
                <Button
                  onClick={handleGuess}
                  size="lg"
                  className="px-8 bg-white hover:bg-white/90 text-black shadow-lg text-lg font-medium h-12"
                >
                  Guess
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Color Legend */}
      {showDistanceGuide && (
        <div className="absolute top-4 right-4 z-20 bg-black/80 p-5 rounded-2xl border border-white/20 shadow-xl backdrop-blur-sm">
          <h3 className="text-sm font-semibold mb-3 text-white/90">Distance Guide</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#4a628acc]"></div>
              <span className="text-sm text-white/80">Less than {formatDistance(1000)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#7ab2d3cc]"></div>
              <span className="text-sm text-white/80">Less than {formatDistance(2500)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#b9e5e8cc]"></div>
              <span className="text-sm text-white/80">Less than {formatDistance(5000)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#b9e5e8cc]"></div>
              <span className="text-sm text-white/80">More than {formatDistance(5000)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Toast Messages */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "bg-[#1a1a1a]/95 border rounded-xl shadow-xl backdrop-blur-sm p-5 w-full max-w-sm animate-in fade-in slide-in-from-right",
              toast.status === 'error' && "border-[#4A628A]/50 text-[#B9E5E8]",
              toast.status === 'success' && "border-[#7AB2D3]/50 text-[#DFF2EB]",
              toast.status === 'warning' && "border-[#B9E5E8]/50 text-[#DFF2EB]"
            )}
          >
            <h4 className="font-['EB Garamond'] text-xl mb-2">{toast.title}</h4>
            <p className="text-sm text-white/80 font-light">{toast.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeoGlobeGame;