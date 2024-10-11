import { EventBusService } from  '@medusajs/medusa';

export class RedisHelper {

    private redisClient: any;
	private eventBusService: EventBusService;

    constructor(eventBusService: EventBusService, redisClient: any) {
	    this.eventBusService = eventBusService;
        this.redisClient = redisClient;
    }

    /**
     * Returns the redis client
     */
    getRedisClient(): any {
        return this.redisClient;
    }

    /**
     * Returns the event bus service
     */
    getEventBus(): EventBusService {
        return this.eventBusService;
    }


    /**
     * Adds a key to the redis store that will be ignored for a certain amount of time 
     */
    async  addIgnore(id: string, side: string, threshold: number): Promise<any> {
        const key = `${id}_ignore_${side}`;
        return await this.redisClient.set(key, 1, 'EX', threshold);
    };
    
    /**
     * Checks if a key should be ignored
     */
    async shouldIgnore(id: string, side: string): Promise<any> {
        const key = `${id}_ignore_${side}`;
        return await this.redisClient.get(key);
    };

}

export default RedisHelper;
