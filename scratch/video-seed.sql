INSERT INTO "EurohouseFeatureGrant"(id,"organizationId","featureKey",status,"nppOrganizationId",source,"activatedByUserId","activatedAt","updatedAt")
SELECT 'g_'||k, 'cmwrd7qe60001mo4kkv0unho3', k::"EurohouseFeatureKey", 'ACTIVE', 'cmwrd7qe90002mo4k76hjon76', 'NPP_DIRECT', 'cmwrd7qi9000pmo4ke1w9g90b', now(), now()
FROM unnest(ARRAY['FORMULA_CUTTING','EUROHOUSE_ORDERING']) k ON CONFLICT DO NOTHING;
INSERT INTO "Debt"(id,type,direction,"partnerName",amount,"paidAmount",status,note,"dueDate","nppOrgId","factoryOrgId","updatedAt") VALUES
('d_demo1','NPP','PAYABLE','NPP Miền Nam',48500000,20000000,'PARTIAL','Đơn nhôm Ecento 70 - đợt 1',now()+interval '9 days','cmwrd7qe90002mo4k76hjon76','cmwrd7qe60001mo4kkv0unho3',now()),
('d_demo2','NPP','PAYABLE','NPP Miền Nam',16200000,0,'OPEN','Phụ kiện và gioăng đợt 2',now()+interval '20 days','cmwrd7qe90002mo4k76hjon76','cmwrd7qe60001mo4kkv0unho3',now())
ON CONFLICT DO NOTHING;
