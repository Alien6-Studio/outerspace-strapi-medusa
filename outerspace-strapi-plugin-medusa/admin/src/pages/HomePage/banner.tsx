import { Box, Typography } from '@strapi/design-system';
import VersionBadges from './version-badge';


interface BannerProps {
    visible: boolean;
  }

const Banner: React.FC<BannerProps> = ({ visible = true }) => {
    if (visible) {
        return (
            <Box padding={4} marginBottom={4} borderColor="neutral500" borderStyle="plain" borderWidth="2px" background="#EAEAEF">
                <Box margin={4} padding={4}>
                    <Typography variant="omega">
                        This plugin is designed for the `OuterSpace Suite` but can be used independently. It helps synchronize Medusa data with Strapi.
                        Please note, commercial use is not permitted. For more information, refer to the <a href="https://www.coopyrightcode.com" target="_blank">license</a>.
                        Full documentation is available on the <a href="https://strapi-medusa.outerspace.sh" target="_blank">OuterSpace Strapi Medusa</a> website.
                        The GitHub repository is located at <a href="https://github.com/Alien6-Studio/outerspace-strapi-medusa.git" target="_blank">Alien6Studio</a> — contributions are welcome!
                    </Typography>
                </Box>
                <Box padding={4}>
                    <Typography variant="omega">
                        For commercial usage inquiries, <a href="mailto:support@outerspace.sh">contact us</a>
                    </Typography>
                </Box>
                <VersionBadges />
            </Box>
        );
    } else {
        return (<></>);
    }
}

export default Banner;