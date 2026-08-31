# Removed-field ledger (M2)

Every field listed below MUST still exist in the `VendorSubmission` interface in
`types/index.ts` after M2 ships (deprecate-in-place, never delete — see the M2 golden README
"Deprecate-in-place, never delete"). None gets a type change. A38/A28 check this list against
the actual interface body.

- `boothCount`
- `electricalLoad`
- `electricalEquipmentList`
- `electricalEquipmentContinuousOperation`
- `electricalEquipmentContinuousDetails`
- `gasEquipmentType`
- `gasFuelType`
- `gasCylinderSize`
- `gasCylinderCount`
- `vehicleType`
- `vehicleTypeOther`
- `vehicleRegistrations`
- `vehicleHeight`
- `vehicleLength`
- `trailerAttached`
- `socialMediaHandle`
- `sellsLivePlants`
- `livePlantTypes`
- `livePlantTypesOther`
- `plantsImportedForEvent`
- `importCountryOfOrigin`
- `foodPreparationOnSite`
- `foodCookingOnSite`
- `vendorCategoryOther` (deprecated by F13, not F15 — listed here too since it follows the same
  rule)
