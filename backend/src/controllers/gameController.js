import { Game } from '../models/Game.js';
import { Wallet } from '../models/Wallet.js';
import { db } from '../config/firebase.js';

export const createGame = async (req, res) => {
  try {
    const gameData = req.body;
    
    const requiredFields = ['name', 'description', 'category', 'type', 'imageUrl', 'downloadUrl'];
    for (const field of requiredFields) {
      if (!gameData[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    if (gameData.type === 'vip' && !gameData.price) {
      return res.status(400).json({ error: 'VIP games must have a price' });
    }

    const gameRef = await Game.create(gameData);
    const game = await Game.findById(gameRef.id);
    
    res.status(201).json({ message: 'Game created successfully', game });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
};

export const updateGame = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const game = await Game.update(id, updates);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json({ message: 'Game updated successfully', game });
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
};

export const deleteGame = async (req, res) => {
  try {
    const { id } = req.params;
    await Game.delete(id);
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
};

export const getGame = async (req, res) => {
  try {
    const { id } = req.params;
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
};

export const getAllGames = async (req, res) => {
  try {
    const { type, category, limit, page, search } = req.query;
    const options = { isHidden: false };
    
    if (type && (type === 'free' || type === 'vip')) {
      options.type = type;
    }
    if (category) {
      options.category = category;
    }
    if (limit) {
      options.limit = parseInt(limit);
    }
    if (search) {
      options.search = search;
    }
    
    const games = await Game.getAll(options);
    res.json(games);
  } catch (error) {
    console.error('Get all games error:', error);
    res.status(500).json({ error: 'Failed to get games' });
  }
};

export const purchaseGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.uid;
    
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.isHidden) {
      return res.status(403).json({ error: 'Game is not available' });
    }

    // Check if already purchased
    const existingPurchase = await db.collection('purchases')
      .where('userId', '==', userId)
      .where('gameId', '==', gameId)
      .limit(1)
      .get();

    if (!existingPurchase.empty) {
      return res.json({ 
        message: 'Game already purchased',
        downloadUrls: game.downloadUrls || [game.downloadUrl]
      });
    }

    // Handle VIP purchase
    if (game.type === 'vip') {
      const wallet = await Wallet.findById(userId);
      if (!wallet || wallet.balance < game.price) {
        return res.status(403).json({ 
          error: 'Insufficient balance',
          required: game.price,
          balance: wallet?.balance || 0
        });
      }

      // Deduct balance
      await Wallet.updateBalance(userId, game.price, 'remove', 'purchase');
      
      // Record purchase
      await db.collection('purchases').add({
        userId,
        gameId,
        gameName: game.name,
        price: game.price,
        type: 'vip',
        purchaseDate: new Date().toISOString()
      });

      // Increment downloads
      await Game.incrementDownloads(gameId);

      return res.json({
        message: 'Game purchased successfully',
        downloadUrls: game.downloadUrls || [game.downloadUrl]
      });
    }

    // Free game
    await db.collection('purchases').add({
      userId,
      gameId,
      gameName: game.name,
      price: 0,
      type: 'free',
      purchaseDate: new Date().toISOString()
    });

    await Game.incrementDownloads(gameId);

    res.json({
      message: 'Game downloaded successfully',
      downloadUrls: game.downloadUrls || [game.downloadUrl]
    });
  } catch (error) {
    console.error('Purchase game error:', error);
    res.status(500).json({ error: 'Failed to purchase game' });
  }
};

export const getUserGames = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('purchases')
      .where('userId', '==', userId)
      .orderBy('purchaseDate', 'desc')
      .get();

    const purchases = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get full game details
    const gameIds = purchases.map(p => p.gameId);
    const gamePromises = gameIds.map(id => Game.findById(id));
    const games = await Promise.all(gamePromises);

    const result = purchases.map((purchase, index) => ({
      ...purchase,
      game: games[index]
    }));

    res.json(result);
  } catch (error) {
    console.error('Get user games error:', error);
    res.status(500).json({ error: 'Failed to get user games' });
  }
};
