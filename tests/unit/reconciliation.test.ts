import { describe, it, expect } from 'vitest';
import { extractNameFromLabel, normalizeName, nameSimilarity } from '@/lib/reconciliation';

describe('Reconciliation Engine - Name Extraction & Normalization', () => {
  
  describe('extractNameFromLabel', () => {
    it('should extract first and last name from a standard Pennylane label format', () => {
      const label = 'Facture Ahmet YILMAZ - NETZ-F-2026-0001';
      const result = extractNameFromLabel(label);
      expect(result).not.toBeNull();
      expect(result?.firstName).toBe('ahmet');
      expect(result?.lastName).toBe('yilmaz');
    });

    it('should handle multi-word last names (all caps)', () => {
      const label = 'Facture Jean-Pierre DE JESUS - NETZ-F-2026-1022';
      const result = extractNameFromLabel(label);
      expect(result).not.toBeNull();
      expect(result?.firstName).toBe('jean-pierre');
      expect(result?.lastName).toBe('de jesus');
    });

    it('should return null for invalid formats', () => {
      const invalidLabel = 'Paiement client sans facture';
      expect(extractNameFromLabel(invalidLabel)).toBeNull();
    });

    it('should return null if there is no dash and NETZ-F- prefix', () => {
      const label = 'Facture Ahmet YILMAZ';
      expect(extractNameFromLabel(label)).toBeNull();
    });
  });

  describe('normalizeName', () => {
    it('should remove accents and convert to lowercase', () => {
      expect(normalizeName('Élise HÉRAULT')).toBe('elise herault');
      expect(normalizeName('François Garçon')).toBe('francois garcon');
    });

    it('should replace hyphens and apostrophes with spaces', () => {
      expect(normalizeName('Jean-Marc')).toBe('jean marc');
      expect(normalizeName("d'Almeida")).toBe('d almeida');
    });

    it('should normalize multiple whitespace characters', () => {
      expect(normalizeName('  Ahmet   Yilmaz  ')).toBe('ahmet yilmaz');
    });

    it('should return empty string for null/undefined input', () => {
      expect(normalizeName(null)).toBe('');
    });
  });

  describe('nameSimilarity', () => {
    it('should return 1 for exact match', () => {
      expect(nameSimilarity('Ahmet YILMAZ', 'ahmet yilmaz')).toBe(1);
    });

    it('should return 0.9 if one name contains the other', () => {
      expect(nameSimilarity('Ahmet Yilmaz', 'Yilmaz')).toBe(0.9);
      expect(nameSimilarity('Marie-Christine', 'Marie')).toBe(0.9);
    });

    it('should calculate intersection-based score for word-reordered names', () => {
      // "ahmet yilmaz" and "yilmaz ahmet" -> 1.0 (exact match bypasses word comparison or word comparison returns 1)
      expect(nameSimilarity('Ahmet Yilmaz', 'Yilmaz Ahmet')).toBe(1);
    });

    it('should calculate fractional similarity for partially matching names', () => {
      // "jean luc picard" and "jean luc" -> 0.9 (since "jean luc" is contained in "jean luc picard")
      expect(nameSimilarity('Jean Luc Picard', 'Jean Luc')).toBe(0.9);
      
      // "jean picard" vs "jean luc picard" -> words intersection = 2/3 = 0.66
      expect(nameSimilarity('Jean Picard', 'Jean Luc Picard')).toBe(2 / 3);
    });

    it('should return 0 for completely different names', () => {
      expect(nameSimilarity('Ahmet YILMAZ', 'Elise HERAULT')).toBe(0);
    });
  });

});
