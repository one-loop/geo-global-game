import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { 
  Box, 
  VStack, 
  Input, 
  Button, 
  Text, 
  useToast as useChakraToast, 
  Container, 
  Heading,
  Flex,
  Badge,
  InputGroup,
} from '@chakra-ui/react';
import { format } from 'date-fns';
import countriesGeoJson from '../data/countries-50m.json';

const MAX_GUESSES = 10;
const EARTH_RADIUS_KM = 6371;

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
    if (distance === 0) return 'rgba(52, 211, 153, 0.8)';     // Emerald green for correct
    if (distance < 1000) return 'rgba(239, 68, 68, 0.8)';     // Soft red for very close
    if (distance < 2500) return 'rgba(249, 115, 22, 0.8)';    // Soft orange for close
    if (distance < 5000) return 'rgba(245, 158, 11, 0.8)';    // Amber for far
    return 'rgba(234, 179, 8, 0.8)';                          // Yellow for very far
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

    // Check if country has already been guessed
    const alreadyGuessed = guesses.some(
      guess => guess.properties.name.toLowerCase() === guessedCountry.name.toLowerCase()
    );

    if (alreadyGuessed) {
      toast({
        title: 'Already Guessed',
        description: `You've already guessed ${guessedCountry.name}. Try a different country!`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'top'
      });
      setCurrentGuess('');
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
      toast({
        title: '🎉 Congratulations!',
        description: `You found the correct country: ${targetCountry.name}! You did it in ${guesses.length + 1} ${guesses.length === 0 ? 'guess' : 'guesses'}!`,
        status: 'success',
        duration: 10000,
        isClosable: true,
        position: 'top',
      });
    } else if (guesses.length + 1 >= MAX_GUESSES) {
      setGameOver(true);
    }
  }, [currentGuess, targetCountry, guesses.length, toast]);

  // Create a list of country suggestions for the input
  const countryNames = useMemo(() => countryData.map(country => country.name), []);

  return (
    <Box h="100vh" w="100vw" position="relative" overflow="hidden" bg="gray.900">
      {/* Globe */}
      <Box position="absolute" top="0" left="0" w="100%" h="100%" zIndex="1">
        <Globe
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
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
          autoRotate={true}
          autoRotateSpeed={0.35}
          zoomOnScroll={true}
          minZoom={0.5}
          maxZoom={2.5}
          rotateSpeed={0.8}
          polygonLabel={({ properties }) =>
            `<div style="background: rgba(17, 25, 40, 0.95); color: white; padding: 12px 16px; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; line-height: 1.4; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
              <div style="font-weight: 600; margin-bottom: 4px;">${properties.name}</div>
              <div style="color: rgba(255, 255, 255, 0.8);">Distance: ${Math.round(properties.distance)} km</div>
            </div>`
          }
        />
      </Box>

      {/* Header Overlay */}
      <Box 
        position="absolute" 
        top="0" 
        left="0" 
        right="0" 
        zIndex="2" 
        p={4}
        background="linear-gradient(to bottom, rgba(17, 25, 40, 0.95), rgba(17, 25, 40, 0))"
      >
        <Container maxW="container.lg">
          <Flex justify="space-between" align="center">
            <Heading 
              color="white" 
              size="lg" 
              fontWeight="semibold" 
              letterSpacing="tight"
              fontSize="24px"
            >
              Geo Globe Game
            </Heading>
            <Badge 
              bg="rgba(255, 255, 255, 0.1)"
              color="white"
              py={2}
              px={4}
              borderRadius="full"
              fontSize="sm"
              fontWeight="medium"
              letterSpacing="tight"
            >
              {MAX_GUESSES - guesses.length} Guesses Left
            </Badge>
          </Flex>
        </Container>
      </Box>

      {/* Game Over Message */}
      {gameOver && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex="2"
          bg="rgba(17, 25, 40, 0.95)"
          p={8}
          borderRadius="xl"
          border="1px solid rgba(255, 255, 255, 0.1)"
          backdropFilter="blur(20px)"
          maxW="500px"
          w="90%"
          textAlign="center"
        >
          <Text fontSize="2xl" fontWeight="semibold" color={won ? 'green.400' : 'red.400'} mb={4}>
            {won ? '🎉 Congratulations!' : 'Game Over'}
          </Text>
          <Text color="whiteAlpha.900" fontSize="lg" mb={3}>
            {won 
              ? `You found ${targetCountry?.name} in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}!`
              : `The country was ${targetCountry?.name}`
            }
          </Text>
          {won && (
            <Text color="whiteAlpha.700" fontSize="md">
              Come back tomorrow for a new challenge!
            </Text>
          )}
        </Box>
      )}

      {/* Bottom Section with Input and Guesses */}
      <Box 
        position="absolute" 
        bottom="0" 
        left="0" 
        right="0" 
        zIndex="2"
        background="linear-gradient(to top, rgba(17, 25, 40, 0.95), rgba(17, 25, 40, 0))"
        pt={8}
        pb={6}
      >
        <Container maxW="container.md">
          <VStack spacing={4}>
            {/* Previous Guesses */}
            {guesses.length > 0 && (
              <Box 
                w="100%" 
                overflowX="auto" 
                pb={2}
                css={{
                  '&::-webkit-scrollbar': {
                    height: '6px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '3px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '3px',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.3)',
                    }
                  },
                }}
              >
                <Flex gap={2} pb={1}>
                  {guesses.map((guess, index) => (
                    <Badge
                      key={index}
                      bg={guess.color}
                      color="white"
                      py={1.5}
                      px={3}
                      borderRadius="full"
                      fontSize="xs"
                      fontWeight="medium"
                      whiteSpace="nowrap"
                      boxShadow="0 2px 4px rgba(0,0,0,0.1)"
                      display="flex"
                      alignItems="center"
                      h="24px"
                    >
                      <Text as="span" mr={1.5}>{guess.properties.name}</Text>
                      <Text as="span" opacity={0.8} fontSize="2xs">{Math.round(guess.properties.distance)} km</Text>
                    </Badge>
                  ))}
                </Flex>
              </Box>
            )}

            {/* Input Section */}
            {!gameOver && (
              <Flex gap={4} w="100%">
                <InputGroup size="lg">
                  <Input
                    placeholder="Enter country name..."
                    value={currentGuess}
                    onChange={(e) => setCurrentGuess(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleGuess()}
                    list="country-list"
                    bg="rgba(255, 255, 255, 0.05)"
                    border="1px solid rgba(255, 255, 255, 0.1)"
                    color="white"
                    _hover={{
                      bg: "rgba(255, 255, 255, 0.08)",
                      borderColor: "rgba(255, 255, 255, 0.2)"
                    }}
                    _focus={{
                      bg: "rgba(255, 255, 255, 0.1)",
                      borderColor: "blue.400",
                      boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.6)"
                    }}
                    _placeholder={{
                      color: "whiteAlpha.500"
                    }}
                    h="50px"
                    fontSize="md"
                  />
                </InputGroup>
                <Button
                  onClick={handleGuess}
                  size="lg"
                  px={8}
                  h="50px"
                  fontSize="md"
                  bg="blue.500"
                  color="white"
                  _hover={{ bg: 'blue.600' }}
                  _active={{ bg: 'blue.700' }}
                  transition="all 0.2s"
                >
                  Guess
                </Button>
              </Flex>
            )}
          </VStack>
        </Container>
      </Box>

      {/* Custom Styled Datalist */}
      <Box
        as="datalist"
        id="country-list"
        sx={{
          '& option': {
            bg: 'rgba(17, 25, 40, 0.95)',
            color: 'white',
            padding: '8px 12px',
            cursor: 'pointer',
            _hover: {
              bg: 'rgba(255, 255, 255, 0.1)'
            }
          }
        }}
      >
        {countryNames.map((name, index) => (
          <option key={index} value={name} />
        ))}
      </Box>

      {/* Color Legend */}
      <Box
        position="absolute"
        top={4}
        right={4}
        zIndex={2}
        bg="rgba(17, 25, 40, 0.8)"
        p={4}
        borderRadius="xl"
        border="1px solid rgba(255, 255, 255, 0.1)"
        backdropFilter="blur(10px)"
      >
        <Text color="white" fontSize="sm" fontWeight="semibold" mb={2}>
          Distance Guide
        </Text>
        <VStack spacing={1} align="stretch">
          <Flex align="center" gap={2}>
            <Box w="12px" h="12px" borderRadius="sm" bg="rgba(52, 211, 153, 0.8)" />
            <Text color="whiteAlpha.900" fontSize="xs">Correct</Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Box w="12px" h="12px" borderRadius="sm" bg="rgba(239, 68, 68, 0.8)" />
            <Text color="whiteAlpha.900" fontSize="xs">&lt; 1000 km</Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Box w="12px" h="12px" borderRadius="sm" bg="rgba(249, 115, 22, 0.8)" />
            <Text color="whiteAlpha.900" fontSize="xs">&lt; 2500 km</Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Box w="12px" h="12px" borderRadius="sm" bg="rgba(245, 158, 11, 0.8)" />
            <Text color="whiteAlpha.900" fontSize="xs">&lt; 5000 km</Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Box w="12px" h="12px" borderRadius="sm" bg="rgba(234, 179, 8, 0.8)" />
            <Text color="whiteAlpha.900" fontSize="xs">&gt; 5000 km</Text>
          </Flex>
        </VStack>
      </Box>
    </Box>
  );
};

export default GeoGlobeGame;