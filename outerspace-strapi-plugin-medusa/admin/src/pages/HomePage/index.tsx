/*
 *
 * HomePage
 *
 */

import React, { useEffect, useState } from 'react';
import { BaseHeaderLayout, ContentLayout } from '@strapi/design-system/Layout';
import { Box, Typography, Button, TextInput } from '@strapi/design-system';

import { getConfig, updateConfig } from "../../utils/api";
import pluginId from "../../pluginId";

interface Config {
  medusaSecret: string;
  medusaBackendUrl: string;
  medusaBackendAdmin: string;
  superuserEmail: string;
  superuserUsername: string;
}

const HomePage: React.FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateConfig = async () => {
    if (config) {
      setIsLoading(true);
      try {
        await updateConfig(config);
        alert("Configuration updated successfully");
      } catch (error) {
        console.error("Error while updating config.", error);
        alert("Failed to update configuration");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof Config) => {
    if (config) {
      setConfig({
        ...config,
        [field]: e.target.value,
      });
    }
  };
  
  const fetchConfig = async () => {
    try {
      const config = await getConfig();
      setConfig(config.data);
    } catch (error) {
      console.error("Error while fetching configs.", error);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);


  return (
    <div>
      <BaseHeaderLayout
        title="Medusa Integration"
        subtitle="Plugin Configuration"
        as="h2"
      />
      <ContentLayout>
        <Box padding={4}>
          <Box padding={2}>
            <Typography variant="beta">Welcome to the Medusa Plugin for Strapi ({pluginId})</Typography>
          </Box>
          <Box padding={2}>
            <Typography>Here, you can synchronize product data from Medusa and enrich it with additional fields and media in Strapi.</Typography>
          </Box>
        </Box>
        
        <Box padding={4}>
          <Typography variant="beta">Plugin Configuration</Typography>

          {config ? (
            <Box>
              <Box padding={2}>
                <TextInput
                  label="Medusa Secret"
                  name="medusaSecret"
                  onChange={(e: any) => handleInputChange(e, 'medusaSecret')}
                  value={config.medusaSecret}
                />
              </Box>
              <Box padding={2}>
                <TextInput
                  label="Medusa Backend URL"
                  name="medusaBackendUrl"
                  onChange={(e: any) => handleInputChange(e, 'medusaBackendUrl')}
                  value={config.medusaBackendUrl}
                />
              </Box>
              <Box padding={2}>
                <TextInput
                  label="Medusa Admin URL"
                  name="medusaBackendAdmin"
                  onChange={(e: any) => handleInputChange(e, 'medusaBackendAdmin')}
                  value={config.medusaBackendAdmin}
                />
              </Box>
              <Box padding={2}>
                <TextInput
                  label="Superuser Email"
                  name="superuserEmail"
                  onChange={(e: any) => handleInputChange(e, 'superuserEmail')}
                  value={config.superuserEmail}
                />
              </Box>
              <Box padding={2}>
                <TextInput
                  label="Superuser Username"
                  name="superuserUsername"
                  onChange={(e) => handleInputChange(e, 'superuserUsername')}
                  value={config.superuserUsername}
                />
              </Box>

              {/* Bouton pour soumettre la configuration mise à jour */}
              <Box padding={2}>
                <Button onClick={handleUpdateConfig} disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Configuration"}
                </Button>
              </Box>
            </Box>
          ) : (
            <Typography>Loading configuration...</Typography>
          )}
          </Box>
      </ContentLayout>
    </div>
  );
};

export default HomePage;
