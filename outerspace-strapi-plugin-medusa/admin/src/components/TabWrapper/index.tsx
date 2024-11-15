import React, { useState, useEffect } from 'react';
import { TabGroup, Tabs, Tab, TabPanels, TabPanel, Typography, Box } from '@strapi/design-system';
import { InjectionZone } from '@strapi/helper-plugin';

import Banner from '../Banner';
import { isProVersion } from '../../utils/api';

interface TabWrapperProps {
  children: React.ReactNode;
}

const TabWrapper: React.FC<TabWrapperProps> = ({ children }) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const [isPro, setProVersion] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkProVersion = async () => {
      try {
        const isPro = await isProVersion();
        setProVersion(isPro);
      } catch (err) {
        console.error("Failed to check pro version:", err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setProVersion(false);
      }
    };

    checkProVersion();
  }, []);

  return (
    <>
      <Banner visible={true} isPro={isPro} />
      <TabGroup 
        id="tabs" 
        onTabChange={setSelectedTab} 
        selected={selectedTab}
      >
        <Tabs>
          <Tab>Configuration</Tab>
          <Tab>Pro version</Tab>
        </Tabs>
        
        <TabPanels>
          <TabPanel>
            {selectedTab === 0 && children}
          </TabPanel>
          <TabPanel>
          {isPro ? (
              <InjectionZone area="outerspace-strapi-plugin-medusa.pro.panels" />
            ) : (
              <Box padding={4} background="neutral100">
                <Typography variant="omega" textColor="neutral600">
                  Pro version not available
                </Typography>
              </Box>
            )}
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </>
  );
};

export default TabWrapper;