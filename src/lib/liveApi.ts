import type { DataApi } from './api';
import * as actions from '@/actions/data.actions';

/** Live data source: thin wrapper over server actions (Prisma/Postgres). */
export const liveApi: DataApi = {
    mode: 'live',
    getProfile: actions.getProfile,
    saveProfile: actions.saveProfile,
    saveTargets: actions.saveTargets,
    getDay: actions.getDay,
    getRange: actions.getRange,
    searchFoods: actions.searchFoods,
    getRecentFoods: actions.getRecentFoods,
    getFavorites: actions.getFavorites,
    getMyFoods: actions.getMyFoods,
    setFavorite: actions.setFavorite,
    createFood: actions.createFood,
    logFood: actions.logFood,
    logManual: actions.logManual,
    updateEntry: actions.updateEntry,
    deleteEntry: actions.deleteEntry,
    restoreEntry: actions.restoreEntry,
    copyMeal: actions.copyMeal,
    getSavedMeals: actions.getSavedMeals,
    saveSavedMeal: actions.saveSavedMeal,
    deleteSavedMeal: actions.deleteSavedMeal,
    logSavedMeal: actions.logSavedMeal,
    getWeights: actions.getWeights,
    logWeight: actions.logWeight,
    deleteWeight: actions.deleteWeight,
};
