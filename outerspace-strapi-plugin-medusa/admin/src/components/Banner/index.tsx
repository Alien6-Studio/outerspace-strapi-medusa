import React from 'react';
import { Box, Link, Typography } from '@strapi/design-system';
import VersionBadges from './version-badge';


interface BannerProps {
    visible: boolean;
    isPro: boolean;
  }

const Banner: React.FC<BannerProps> = ({ visible = true , isPro = false}) => {
    
    if (!visible) return null;
    return (
        <Box padding={4} marginBottom={4} borderColor="neutral500" borderStyle="plain" borderWidth="2px" background="neutral150">
            <Box margin={4} padding={4}>
                <Typography variant="omega">
                {isPro && "Welcome to the Pro version! "}
                This plugin is designed for the `OuterSpace Suite` but can be used independently. 
                It helps synchronize Medusa data with Strapi.
                {!isPro && (
                    <>
                    Please note, commercial use is not permitted. For more information, refer to the{' '}
                    <Link href="https://www.coopyrightcode.com" target="_blank">
                        license
                    </Link>.
                    </>
                )}
                Full documentation is available on the{' '}
                <Link href="https://strapi-medusa.outerspace.sh" target="_blank">
                    OuterSpace Strapi Medusa
                </Link>
                {' '}website. The GitHub repository is located at{' '}
                <Link href="https://github.com/Alien6-Studio/outerspace-strapi-medusa.git" target="_blank">
                    Alien6Studio
                </Link>
                {' '}— contributions are welcome!
                </Typography>
            </Box>

            {!isPro && (
                <Box padding={4}>
                <Typography variant="omega">
                    For commercial usage inquiries,{' '}
                    <Link href="mailto:support@outerspace.sh" target="_blank">
                    contact us.
                    </Link>
                </Typography>
                </Box>
            )}
        <VersionBadges />
    </Box>
    )
}

export default Banner;