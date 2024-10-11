import React, { useEffect, useState } from 'react';
import { BaseHeaderLayout, ContentLayout } from '@strapi/design-system/Layout';
import { Box, Button, Flex, IconButton, TextInput, Typography } from '@strapi/design-system';
import { Eye, EyeStriked } from '@strapi/icons';

import Banner from './banner';
import { getConfig, updateConfig, synchronizeWithMedusa } from "../../utils/api";

interface Config {
  medusaSecret: string;
  medusaBackendUrl: string;
  medusaBackendAdmin: string;
  medusaUser: string;
  medusaPassword: string;
  medusaEmail: string;
  superuserEmail: string;
  superuserUsername: string;
  superuserPassword: string;
}

const HomePage: React.FC = () => {

  const initialConfig: Config = {
    medusaSecret: "",
    medusaBackendUrl: "",
    medusaBackendAdmin: "",
    medusaUser: "",
    medusaPassword: "",
    medusaEmail: "",
    superuserEmail: "",
    superuserUsername: "",
    superuserPassword: "",
  };
  
  const [config, setConfig] = useState<Config>(initialConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState<{ [key: string]: boolean }>({
    medusaPassword: false,
    superuserPassword: false,
    medusaSecret: false,
  });

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

  const handleInputChange = (e: { target: { value: any; }; }, field: string) => {
    setConfig({
      ...config,
      [field]: e.target.value,
    });
  };

  const handleTestSynchronization = async () => {
    try {
      await synchronizeWithMedusa();
      alert("Synchonization successful");
    } catch (error) {
        console.error("Error while testing synchronization.", error);
        alert("Failed to test synchronization");
    } 
  }

  const togglePasswordVisibility = (field: string) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: !prevState[field as keyof typeof prevState],
    }));
  };

  const fetchConfig = async () => {
    try {
      const configData = await getConfig();
      setConfig(configData.data);
    } catch (error) {
      console.error("Error while fetching configs.", error);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div>
      <BaseHeaderLayout title="Medusa Integration" subtitle="Plugin Configuration" as="h2" />
      <ContentLayout>
        <Box padding={4}>
          <Banner visible />
          <Box margin={4} padding={4} borderColor="neutral500" borderStyle="plain" borderWidth="2px" background="#FFF">
            <Typography variant="beta">Medusa Server Configuration</Typography>
            <Box padding={2}>
              <TextInput
                label="Medusa Backend URL"
                name="medusaBackendUrl"
                onChange={(e: any) => handleInputChange(e, 'medusaBackendUrl')}
                value={config?.medusaBackendUrl}
              />
            </Box>
            <Box padding={2}>
              <TextInput
                label="Medusa Admin URL"
                name="medusaBackendAdmin"
                onChange={(e: any) => handleInputChange(e, 'medusaBackendAdmin')}
                value={config?.medusaBackendAdmin}
              />
            </Box>
            <Box padding={2} display="flex" alignItems="center">
                <TextInput
                  type={passwordVisibility.medusaSecret ? "text" : "password"}
                  label="Medusa Secret"
                  name="medusaSecret"
                  onChange={(e: any) => handleInputChange(e, 'medusaSecret')}
                  value={config?.medusaSecret}
                  style={{ flex: 1 }}
                />
              <IconButton
                label={passwordVisibility.medusaSecret ? "Hide secret" : "Show secret"}
                icon={passwordVisibility.medusaSecret ? <EyeStriked /> : <Eye />}
                onClick={() => togglePasswordVisibility('medusaSecret')}
                size="L"
                style={{ marginLeft: ".2em", marginTop: "50%", display: "flex", alignItems: "center" }} 
              />
            </Box>
          </Box>
        </Box>

        <Box padding={4}>
          <Box padding={4} borderColor="neutral500" borderStyle="plain" borderWidth="2px" background="#FFF">
            <Typography variant="beta">Sync User Configuration</Typography>
            <Box padding={2}>
              <TextInput
                label="Medusa Username"
                name="medusaUser"
                onChange={(e: any) => handleInputChange(e, 'medusaUser')}
                value={config?.medusaUser}
              />
            </Box>
            <Box padding={2} display="flex" alignItems="center">
                <TextInput
                  type={passwordVisibility.medusaPassword ? "text" : "password"}
                  label="Medusa Password"
                  name="medusaPassword"
                  onChange={(e: any) => handleInputChange(e, 'medusaPassword')}
                  value={config?.medusaPassword}
                  style={{ flex: 1 }}
                />
              <IconButton
                label={passwordVisibility.medusaPassword ? "Hide password" : "Show password"}
                icon={passwordVisibility.medusaPassword ? <EyeStriked /> : <Eye />}
                onClick={() => togglePasswordVisibility('medusaPassword')}
                size="L"
                style={{ marginLeft: ".2em", marginTop: "50%", display: "flex", alignItems: "center" }} 
              />
            </Box>
          </Box>
        </Box>

        <Box padding={4}>
          <Box padding={4} borderColor="neutral500" borderStyle="plain" borderWidth="2px" background="#FFF">
            <Typography variant="beta">Medusa Superuser Configuration</Typography>
            <Box padding={2}>
              <TextInput
                label="Superuser Email"
                name="superuserEmail"
                onChange={(e: any) => handleInputChange(e, 'superuserEmail')}
                value={config?.superuserEmail}
              />
            </Box>
            <Box padding={2}>
              <TextInput
                label="Superuser Username"
                name="superuserUsername"
                onChange={(e: any) => handleInputChange(e, 'superuserUsername')}
                value={config?.superuserUsername}
              />
            </Box>
            <Box padding={2} display="flex" alignItems="center">
                <TextInput
                  type={passwordVisibility.superuserPassword ? "text" : "password"}
                  label="Superuser Password"
                  name="superuserPassword"
                  onChange={(e: any) => handleInputChange(e, 'superuserPassword')}
                  value={config?.superuserPassword}
                  style={{ flex: 1 }}
                />
              <IconButton
                label={passwordVisibility.superuserPassword ? "Hide password" : "Show password"}
                icon={passwordVisibility.superuserPassword ? <EyeStriked /> : <Eye />}
                onClick={() => togglePasswordVisibility('superuserPassword')}
                size="L"
                style={{ marginLeft: ".2em", marginTop: "50%", display: "flex", alignItems: "center" }} 
              />
            </Box>
          </Box>

          <Flex gap={{ initial: 1, medium: 4, large: 8 }} direction={{ initial: 'row', medium: 'row' }} alignItems={{ initial: 'center', medium: 'flex-start' }}>
            <Box padding={2}>
              <Button onClick={handleUpdateConfig} disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Configuration"}
              </Button>
            </Box>
            <Box padding={2}>
              <Button onClick={handleTestSynchronization} disabled={isLoading} background="secondary500" borderColor="secondary500"> 
                {isLoading ? "Updating..." : "Test Synchronization"}
              </Button>
            </Box>
          </Flex>
        </Box>
      </ContentLayout>
    </div>
  );
};

export default HomePage;
