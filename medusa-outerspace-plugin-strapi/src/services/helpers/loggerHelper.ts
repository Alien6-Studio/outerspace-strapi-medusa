import cloneDeep from 'lodash/cloneDeep';
import isObject from 'lodash/isObject';

/**
 * A helper class to log messages with different log levels.
 */
export class LoggerHelper {
    private logger: any = console;


    /**
     * Constructor
     */
    constructor(logger: any) {
        this.logger = logger;
    }
    
    /**
     * Get the logger instance. 
     */
    getLogger() {
        return this.logger;
    }

    /**
     * Log a message with different log levels.
     */
    log(logType: string, message: string, data?: Record<string, any>) {
        // Clone data to avoid mutating original object and sanitize it
        if (data && isObject(data)) {
            data = cloneDeep(data);
            if (data.password) data.password = '######';  // Mask the password
        }

        const formattedMessage = `${message}, data: ${data ? JSON.stringify(data) : ''}`;

        // Handle different log types
        switch (logType) {
            case 'error':
                this.logger.error(formattedMessage);
                break;
            case 'warn':
                this.logger.warn(formattedMessage);
                break;
            case 'debug':
                this.logger.debug(formattedMessage);
                break;
            default:
                this.logger.info(formattedMessage);
                break;
        }
    }
}