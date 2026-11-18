UPDATE "AluSystem"
SET "name" = 'Hệ 55 Vát Cạnh',
    "description" = 'Cửa đi & cửa sổ mở quay hệ 55 vát cạnh'
WHERE "code" = 'EU-55';

UPDATE "QuotationItem"
SET "system" = 'Hệ 55 Vát Cạnh'
WHERE "system" IN ('Hệ 55 Euroqueen', 'EUROQUEEN Hệ 55', 'EUROQUEEN 55');

UPDATE "FormulaTemplate"
SET "systemName" = 'Hệ 55 Vát Cạnh'
WHERE "systemName" IN ('Hệ 55 Euroqueen', 'EUROQUEEN Hệ 55', 'EUROQUEEN 55');

UPDATE "CuttingFormula"
SET "aluSystem" = 'Hệ 55 Vát Cạnh'
WHERE "aluSystem" IN ('Hệ 55 Euroqueen', 'EUROQUEEN Hệ 55', 'EUROQUEEN 55');
