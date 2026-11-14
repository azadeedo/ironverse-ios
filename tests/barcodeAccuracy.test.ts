import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { barcodeChecksumOk, barcodeVariants, expandUpcE, lookupBarcode, macroCheck, saveUserProduct } from '@/lib/barcode'

// 15 Nov 2026: about half of the owner's scans showed the wrong product. Root causes covered here.
describe('barcode accuracy', () => {
  it('accepts real EAN-13 / UPC-A / EAN-8 codes by their check digit', () => {
    expect(barcodeChecksumOk('9300675024235')).toBe(true)   // an Australian EAN-13
    expect(barcodeChecksumOk('9310072001784')).toBe(true)
    expect(barcodeChecksumOk('036000291452')).toBe(true)    // UPC-A
    expect(barcodeChecksumOk('96385074')).toBe(true)        // EAN-8
  })

  it('rejects a code with one misread digit (the main cause of wrong products)', () => {
    expect(barcodeChecksumOk('9300675024236')).toBe(false)
    expect(barcodeChecksumOk('9300675024535')).toBe(false)
  })

  it('treats UPC-A, EAN-13 with a leading 0 and UPC-E as the same product', () => {
    expect(barcodeVariants('036000291452')).toContain('0036000291452')
    expect(barcodeVariants('0036000291452')).toContain('036000291452')
    expect(expandUpcE('04252614')).toBe('042100005264')
  })

  it('never looks up a misread code', async () => {
    await expect(lookupBarcode('9300675024236')).rejects.toMatchObject({ kind: 'bad-code' })
  })

  it('your fixed version wins over the database, even on refresh', async () => {
    const { db } = await import('@/db')
    await db.open()
    await saveUserProduct({ barcode: '9300675024235', name: 'My checked yoghurt', per100: { kcal: 95, protein: 9, carbs: 6, fat: 3.5 }, dietTags: [], cached: true, fetchedAt: '' } as never)
    const p = await lookupBarcode('9300675024235', { forceRefresh: true })
    expect(p.name).toBe('My checked yoghurt')
    expect(p.userVerified).toBe(true)
  })

  it('flags calories that do not match protein, carbs and fat (4/4/9)', () => {
    expect(macroCheck({ kcal: 95, protein: 9, carbs: 6, fat: 3.5 })).toBeNull()
    expect(macroCheck({ kcal: 300, protein: 9, carbs: 6, fat: 3.5 })).toMatch(/add up to about/)
  })
})
