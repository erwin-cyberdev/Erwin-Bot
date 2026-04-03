// utils/render.js - Gestion de l'API Render
import { axiosJSON } from './axiosInstances.js'
import dotenv from 'dotenv'
dotenv.config()

const RENDER_API_KEY = process.env.RENDER_API_KEY
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID
const BASE_URL = 'https://api.render.com/v1'

/**
 * Configure les headers pour l'API Render
 */
const getHeaders = () => ({
  'Authorization': `Bearer ${RENDER_API_KEY}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
})

/**
 * Récupère les informations du service
 */
export async function getServiceStatus() {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    throw new Error('RENDER_API_KEY ou RENDER_SERVICE_ID manquant dans le .env')
  }

  try {
    const response = await axiosJSON.get(`${BASE_URL}/services/${RENDER_SERVICE_ID}`, {
      headers: getHeaders()
    })
    return response.data
  } catch (error) {
    console.error('Erreur Render API (getServiceStatus):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Déclenche un nouveau déploiement (redémarrage)
 */
export async function restartService() {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    throw new Error('RENDER_API_KEY ou RENDER_SERVICE_ID manquant dans le .env')
  }

  try {
    const response = await axiosJSON.post(`${BASE_URL}/services/${RENDER_SERVICE_ID}/deploys`, {}, {
      headers: getHeaders()
    })
    return response.data
  } catch (error) {
    console.error('Erreur Render API (restartService):', error.response?.data || error.message)
    throw error
  }
}

/**
 * Récupère la liste des déploiements récents
 */
export async function getRecentDeploys(limit = 5) {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    throw new Error('RENDER_API_KEY ou RENDER_SERVICE_ID manquant dans le .env')
  }

  try {
    const response = await axiosJSON.get(`${BASE_URL}/services/${RENDER_SERVICE_ID}/deploys?limit=${limit}`, {
      headers: getHeaders()
    })
    return response.data
  } catch (error) {
    console.error('Erreur Render API (getRecentDeploys):', error.response?.data || error.message)
    throw error
  }
}
