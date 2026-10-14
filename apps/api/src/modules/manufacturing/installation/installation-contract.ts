export type InstallationHandoff = {
  productionJobReference: string;
  projectReference: string;
  packageReferences: string[];
  qcAccepted: boolean;
  installationNotes?: string;
};
