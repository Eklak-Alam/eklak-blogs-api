import { Router } from 'express';

// Sub-route imports (Notice the '../modules/' path now!)
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import taxonomyRoutes from '../modules/category/category.routes.js';
import postRoutes from '../modules/post/post.routes.js';
import interactionRoutes from '../modules/interaction/interaction.routes.js';

const router = Router();

/**
 * ==========================================
 * MASTER API ROUTER (v1)
 * ==========================================
 */

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);

// Mount Taxonomy and Interactions at the root
router.use('/', taxonomyRoutes); 
router.use('/', interactionRoutes);

export default router;