import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { Box, VStack, Input, Button, Text, useToast as useChakraToast, Container, Heading } from '@chakra-ui/react';
import { format } from 'date-fns';
import countriesGeoJson from '../data/countries-110m.json';

const MAX_GUESSES = 10;
const EARTH_RADIUS_KM = 6371;

// Process the GeoJSON data to create our country list
const countryData = countriesGeoJson.features.map(feature => ({
  name: feature.properties.NAME || feature.properties.ADMIN,
  latitude: feature.properties.LATITUDE || 0,
  longitude: feature.properties.LONGITUDE || 0,
  geometry: feature.geometry,
  id: feature.properties.ISO_A3
}));

const GeoGlobeGame = () => {
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [targetCountry, setTargetCountry] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const toast = useChakraToast();

  // Get daily country based on the date
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const countryIndex = seed % countryData.length;
    setTargetCountry(countryData[countryIndex]);
  }, []);

  // Calculate the centroid of a polygon
  const calculateCentroid = (coordinates) => {
    if (!coordinates || coordinates.length === 0) return [0, 0];
    
    // Handle MultiPolygon
    if (coordinates[0][0][0] && typeof coordinates[0][0][0] === 'number') {
      // Single polygon
      const points = coordinates[0];
      const sumLat = points.reduce((sum, point) => sum + point[1], 0);
      const sumLng = points.reduce((sum, point) => sum + point[0], 0);
      return [sumLng / points.length, sumLat / points.length];
    } else {
      // MultiPolygon - use the first polygon
      const points = coordinates[0][0];
      const sumLat = points.reduce((sum, point) => sum + point[1], 0);
      const sumLng = points.reduce((sum, point) => sum + point[0], 0);
      return [sumLng / points.length, sumLat / points.length];
    }
  };

  // Calculate distance between two points on Earth
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  };

  // Get color based on distance
  const getColorByDistance = (distance) => {
    if (distance === 0) return '#4CAF50';      // Green for correct
    if (distance < 1000) return '#FF5252';     // Dark red for very close
    if (distance < 2500) return '#FF7B7B';     // Red for close
    if (distance < 5000) return '#FFB74D';     // Orange for far
    return '#FFEB3B';                          // Yellow for very far
  };

  const handleGuess = useCallback(() => {
    if (!currentGuess.trim()) return;

    const guessedCountry = countryData.find(
      (country) => country.name.toLowerCase() === currentGuess.toLowerCase()
    );

    if (!guessedCountry) {
      toast({
        title: 'Invalid country',
        description: 'Please enter a valid country name',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top'
      });
      return;
    }

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
    } else if (guesses.length + 1 >= MAX_GUESSES) {
      setGameOver(true);
    }
  }, [currentGuess, targetCountry, guesses.length, toast]);

  // Create a list of country suggestions for the input
  const countryNames = useMemo(() => countryData.map(country => country.name), []);

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8}>
        <Heading>Geo Globe Game</Heading>
        <Box w="100%" h="600px" position="relative">
          <Globe
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            polygonsData={guesses}
            polygonAltitude={0.01}
            polygonCapColor={d => d.color}
            polygonSideColor={() => 'rgba(0, 100, 0, 0.15)'}
            polygonStrokeColor={() => '#111'}
            polygonLabel={({ properties }) =>
              `<div style="background: rgba(0,0,0,0.75); color: white; padding: 5px; border-radius: 5px;">
                <b>${properties.name}</b><br/>
                Distance: ${Math.round(properties.distance)} km
              </div>`
            }
          />
        </Box>
        <Box w="100%" maxW="md">
          <VStack spacing={4}>
            <Text>
              Guesses remaining: {MAX_GUESSES - guesses.length} / {MAX_GUESSES}
            </Text>
            {gameOver ? (
              <Text fontSize="xl" fontWeight="bold" color={won ? 'green.500' : 'red.500'}>
                {won ? 'Congratulations! You won!' : `Game Over! The country was ${targetCountry?.name}`}
              </Text>
            ) : (
              <>
                <Input
                  placeholder="Enter country name"
                  value={currentGuess}
                  onChange={(e) => setCurrentGuess(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGuess()}
                  list="country-list"
                />
                <datalist id="country-list">
                  {countryNames.map((name, index) => (
                    <option key={index} value={name} />
                  ))}
                </datalist>
                <Button colorScheme="blue" onClick={handleGuess} isFullWidth>
                  Guess
                </Button>
              </>
            )}
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default GeoGlobeGame; 