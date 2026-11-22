INSERT INTO "EurohouseFeatureGrant"(id,"organizationId","featureKey",status,"nppOrganizationId",source,"activatedByUserId","activatedAt","updatedAt")
SELECT 'g_'||k, (select id from "Organization" where name='Xưởng sản xuất 01'), k::"EurohouseFeatureKey", 'ACTIVE', (select id from "Organization" where name='NPP Miền Nam'), 'NPP_DIRECT', (select id from "User" where email='npp@eurohouse.vn'), now(), now()
FROM unnest(ARRAY['FORMULA_CUTTING','EUROHOUSE_ORDERING']) k ON CONFLICT DO NOTHING;
INSERT INTO "Debt"(id,type,direction,"partnerName",amount,"paidAmount",status,note,"dueDate","nppOrgId","factoryOrgId","updatedAt")
SELECT x.id,'NPP','PAYABLE','NPP Miền Nam',x.a,x.p,x.s,x.n,now()+x.d::interval,(select id from "Organization" where name='NPP Miền Nam'),(select id from "Organization" where name='Xưởng sản xuất 01'),now()
FROM (VALUES ('d_v2_1',48500000,20000000,'PARTIAL','Đơn nhôm Ecento 70 - đợt 1','9 days'),('d_v2_2',16200000,0,'OPEN','Phụ kiện và gioăng đợt 2','20 days')) AS x(id,a,p,s,n,d) ON CONFLICT DO NOTHING;
INSERT INTO "WorkshopPilotConfig"(id,"organizationId",active,survey,inventory,"shopFloor",quality,installation,warranty,"enabledAt","updatedById","updatedAt")
SELECT 'pc_v2',(select id from "Organization" where name='Xưởng sản xuất 01'),true,true,true,true,true,true,true,now(),(select id from "User" where email='tho@eurohouse.vn'),now() ON CONFLICT DO NOTHING;
