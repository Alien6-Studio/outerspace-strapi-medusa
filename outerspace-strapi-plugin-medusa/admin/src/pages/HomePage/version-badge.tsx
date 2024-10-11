import { Flex, Box, Badge } from '@strapi/design-system';

const VersionBadges = () => {
  return (
    <Flex gap={2} direction={{ initial: 'row', medium: 'row' }} alignItems={{ initial: 'flex-start' }}>
        <Box padding={4}><Badge backgroundColor="secondary500" textColor="neutral0" size="S">Version: 1.0.0</Badge></Box>
        <Box padding={4}><Badge backgroundColor="secondary500" textColor="neutral0" size="S">Strapi: &gt;4.0.0</Badge></Box>
        <Box padding={4}><Badge backgroundColor="secondary500" textColor="neutral0" size="S">Medusa: &gt;2.0.0</Badge></Box>
        <Box padding={4}><Badge backgroundColor="secondary500" textColor="neutral0" size="S">Node: &gt;18.0.0</Badge></Box>
        <Box padding={4}><Badge backgroundColor="secondary500" textColor="neutral0" size="S">License: CoopyrightCode Light v1.1</Badge></Box>
    </Flex>
  );
};

export default VersionBadges;
